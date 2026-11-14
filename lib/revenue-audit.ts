// Оборот audit (owner, 14.11.2026). Read-only cross-check of the Оборот tab for the current and the previous Sofia month:
//   1. every order by status (count, money collected, goods = total - shipping);
//   2. Econt: every parcel we have a tracking number for, Econt's own state (delivered / COD collected / returned) vs our status,
//      plus Econt shipments of ours that no order points at;
//   3. Stripe: every paid Checkout Session vs our orders;
//   4. pricing sanity (1+1 / gifts / discounts taken off once) and orders that look like tests but are not marked;
//   5. Meta: account spend per day straight from Meta vs the synced meta_ad_insights rows the tab uses;
//   6. the e-mail problems behind the health check.
// Owner only; the only write is fixDeliveryDates() (completed_at <- Econt's real delivery time), run from the page's button.
import type Stripe from "stripe";
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { getRawStatuses, rawVerdict, getMyAWB, type RawStatus } from "@/lib/econt";
import { getStripe } from "@/lib/stripe";
import { fetchAccountDailySpend } from "@/lib/meta-ads";
import { sofiaDay, sofiaMidnight, shiftDay } from "@/lib/sofia-time";
import { EUR_RON } from "@/lib/ro/config";
import { isUnpaidCardAttempt } from "@/lib/order-status";

export type AuditOrder = {
  id: number; order_ref: string | null; name: string | null; phone: string | null; email: string | null; status: string;
  total: number | null; subtotal: number | null; shipping_cost: number | null; items: { slug?: string; name?: string; price?: number; quantity?: number; qty?: number; gift?: boolean }[] | null;
  created_at: string; completed_at: string | null; completed_source?: string | null; excluded_from_stock: boolean | null;
  ship_country: string | null; is_international: boolean | null; tracking_number: string | null; notes: string | null;
  payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null; stripe_session_id?: string | null;
  promo_discount?: number | null; card_discount?: number | null;
};
type StatusRow = { status: string; count: number; collected: number; goods: number };
type Line = { ref: string; status: string; eur: number; note: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const isRo = (o: AuditOrder) => o.ship_country === "RO";
const eurOf = (o: AuditOrder, n: number) => (isRo(o) ? n / EUR_RON : n);
const goodsOf = (o: AuditOrder) => eurOf(o, Math.max(0, (Number(o.total) || 0) - (Number(o.shipping_cost) || 0)));
const ref = (o: AuditOrder) => o.order_ref ?? `#${o.id}`;
const monthOf = (iso: string | null | undefined) => (iso ? sofiaDay(new Date(iso)).slice(0, 7) : "");
const TEST_RE = /\b(test|тест|проба|fake)\b/i;

async function fetchOrders(sinceISO: string): Promise<AuditOrder[]> {
  const sb = await adminDb();
  const base = "id, order_ref, name, phone, email, status, total, subtotal, shipping_cost, items, created_at, completed_at, excluded_from_stock, ship_country, is_international, tracking_number, notes";
  const variants = [
    `${base}, completed_source, payment_method, payment_status, stripe_payment_intent, stripe_session_id, promo_discount, card_discount`,
    `${base}, completed_source, payment_method, payment_status, stripe_payment_intent, stripe_session_id, promo_discount`,
    `${base}, payment_method, payment_status, stripe_payment_intent`,
    base,
  ];
  for (const cols of variants) {
    const out: AuditOrder[] = [];
    let failed = false;
    // placed in the window OR delivered in it (an old order completed this month counts for this month)
    for (let from = 0; from < 20_000; from += 1000) {
      const q = await sb.from("orders").select(cols).or(`created_at.gte.${sinceISO},completed_at.gte.${sinceISO}`).order("created_at").range(from, from + 999);
      if (q.error) { failed = true; break; }
      out.push(...((q.data ?? []) as unknown as AuditOrder[]));
      if ((q.data ?? []).length < 1000) break;
    }
    if (!failed) return out;
  }
  return [];
}

export type RevenueAudit = Awaited<ReturnType<typeof buildAudit>>;

export async function getRevenueAudit() {
  if ((await getAdminSession())?.role !== "owner") return null;
  return buildAudit();
}

async function buildAudit() {
  const today = sofiaDay();
  const cur = today.slice(0, 7);
  const curStart = `${cur}-01`;
  const prevEnd = shiftDay(curStart, 1);
  const prev = prevEnd.slice(0, 7);
  const prevStart = `${prev}-01`;
  const sinceISO = sofiaMidnight(prevStart).toISOString();
  const errors: string[] = [];

  const all = await fetchOrders(sinceISO);
  const leads = all.filter((o) => o.is_international && !isRo(o));                 // international waitlist, never sales
  const tests = all.filter((o) => o.excluded_from_stock);
  const attempts = all.filter((o) => !o.excluded_from_stock && isUnpaidCardAttempt(o as never));
  const real = all.filter((o) => !o.excluded_from_stock && !isUnpaidCardAttempt(o as never) && !(o.is_international && !isRo(o)));

  // 1. statuses per month (by the day the order was placed)
  const byStatus = (month: string): StatusRow[] => {
    const m = new Map<string, StatusRow>();
    for (const o of real) {
      if (monthOf(o.created_at) !== month) continue;
      const r = m.get(o.status) ?? { status: o.status, count: 0, collected: 0, goods: 0 };
      r.count++; r.collected += eurOf(o, Number(o.total) || 0); r.goods += goodsOf(o);
      m.set(o.status, r);
    }
    return [...m.values()].map((r) => ({ ...r, collected: round2(r.collected), goods: round2(r.goods) })).sort((a, b) => b.count - a.count);
  };
  // what the tab counts: completed, bucketed by completed_at
  const tabMonth = (month: string) => {
    const rows = real.filter((o) => o.status === "completed" && monthOf(o.completed_at ?? o.created_at) === month);
    return { count: rows.length, goods: round2(rows.reduce((s, o) => s + goodsOf(o), 0)), collected: round2(rows.reduce((s, o) => s + eurOf(o, Number(o.total) || 0), 0)) };
  };

  // 2. Econt
  const bg = real.filter((o) => !isRo(o));
  const withAwb = bg.filter((o) => (o.tracking_number ?? "").trim());
  const raw = new Map<string, RawStatus>();
  try {
    const awbs = [...new Set(withAwb.map((o) => String(o.tracking_number).replace(/\s+/g, "")))];
    for (let i = 0; i < awbs.length; i += 50) for (const [k, v] of await getRawStatuses(awbs.slice(i, i + 50))) raw.set(k, v);
  } catch (e) { errors.push(`Econt: ${e instanceof Error ? e.message : e}`); }
  const econtDeliveredNotCompleted: Line[] = [];
  const completedNotDeliveredInEcont: Line[] = [];
  const wrongMonth: (Line & { ours: string; econt: string })[] = [];
  const econtReturnedButLive: Line[] = [];
  const dateFixes: { id: number; ref: string; from: string | null; to: string }[] = [];
  for (const o of withAwb) {
    const r = raw.get(String(o.tracking_number).replace(/\s+/g, ""));
    if (!r) continue;
    const v = rawVerdict(r);
    const deliveredMs = r.deliveryTime ?? r.cdCollectedTime ?? null;
    if (v === "delivered" && o.status !== "completed")
      econtDeliveredNotCompleted.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `Еконт: ${r.shortDeliveryStatus ?? "доставена"}${deliveredMs ? ` ${sofiaDay(new Date(Number(deliveredMs)))}` : ""}` });
    if (o.status === "completed" && v !== "delivered")
      completedNotDeliveredInEcont.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `Еконт: ${r.shortDeliveryStatus ?? v}` });
    if (v === "returned" && ["new", "confirmed", "shipped", "completed"].includes(o.status))
      econtReturnedButLive.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `Еконт: ${r.shortDeliveryStatus ?? "върната"}` });
    if (o.status === "completed" && v === "delivered" && deliveredMs) {
      const real = new Date(Number(deliveredMs)).toISOString();
      if (monthOf(o.completed_at) !== monthOf(real))
        wrongMonth.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: "", ours: o.completed_at ? sofiaDay(new Date(o.completed_at)) : "—", econt: sofiaDay(new Date(real)) });
      if (!o.completed_at || Math.abs(new Date(o.completed_at).getTime() - Number(deliveredMs)) > 60 * 60_000)
        dateFixes.push({ id: o.id, ref: ref(o), from: o.completed_at, to: real });
    }
  }
  const shippedNoAwb: Line[] = bg.filter((o) => (o.status === "shipped" || o.status === "completed") && !(o.tracking_number ?? "").trim())
    .map((o) => ({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: "без номер на товарителница" }));
  // Econt shipments of ours that no order points at (by AWB)
  const ourAwbs = new Set(all.map((o) => String(o.tracking_number ?? "").replace(/\s+/g, "")).filter(Boolean));
  let econtOrphans: { awb: string; cod: number; status: string; created: string }[] = [];
  let econtCodDelivered = { count: 0, cod: 0 };
  try {
    const list = await getMyAWB(prevStart, shiftDay(today, -1), "sender");
    econtOrphans = list.filter((a) => a.shipmentNumber && !ourAwbs.has(a.shipmentNumber.replace(/\s+/g, "")))
      .map((a) => ({ awb: a.shipmentNumber, cod: a.cdAmount, status: a.status, created: a.createdDate ? sofiaDay(new Date(a.createdDate)) : "" }));
    for (const a of list) if (/доставена/i.test(a.status) && a.cdAmount > 0) { econtCodDelivered.count++; econtCodDelivered.cod += a.cdAmount; }
    econtCodDelivered.cod = round2(econtCodDelivered.cod);
  } catch (e) { errors.push(`Econt getMyAWB: ${e instanceof Error ? e.message : e}`); }

  // 3. Stripe
  const stripePaidNoOrder: { session: string; ref: string | null; amount: number; created: string }[] = [];
  const stripePaidOrderNotSale: Line[] = [];
  const orderPaidNoStripe: Line[] = [];
  let stripePaid = { count: 0, eur: 0 };
  try {
    if ((process.env.STRIPE_SECRET_KEY ?? "").trim()) {
      const stripe = getStripe();
      const byRef = new Map(all.filter((o) => o.order_ref).map((o) => [o.order_ref as string, o]));
      const paidRefs = new Set<string>();
      const since = Math.floor(new Date(sinceISO).getTime() / 1000);
      for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 }) as AsyncIterable<Stripe.Checkout.Session>) {
        if (s.payment_status !== "paid") continue;
        const r = s.metadata?.order_ref ?? s.client_reference_id ?? null;
        const amount = (s.amount_total ?? 0) / 100;
        const eur = String(s.currency).toLowerCase() === "ron" ? amount / EUR_RON : amount;
        stripePaid.count++; stripePaid.eur += eur;
        const o = r ? byRef.get(r) : undefined;
        if (r) paidRefs.add(r);
        if (!o) { stripePaidNoOrder.push({ session: s.id, ref: r, amount, created: sofiaDay(new Date(s.created * 1000)) }); continue; }
        if (o.excluded_from_stock || !["new", "confirmed", "shipped", "completed"].includes(o.status))
          stripePaidOrderNotSale.push({ ref: ref(o), status: o.excluded_from_stock ? `${o.status} (тестова)` : o.status, eur: round2(eur), note: o.payment_status === "refunded" ? "върнати пари" : `плащане ${o.payment_status ?? "?"}` });
      }
      stripePaid.eur = round2(stripePaid.eur);
      for (const o of real) if (o.payment_status === "paid" && o.order_ref && !paidRefs.has(o.order_ref) && new Date(o.created_at).getTime() >= since * 1000)
        orderPaidNoStripe.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: "отбелязана платена, няма платена сесия в Stripe" });
    } else errors.push("Stripe: няма STRIPE_SECRET_KEY");
  } catch (e) { errors.push(`Stripe: ${e instanceof Error ? e.message : e}`); }

  // 4. pricing sanity + possible unmarked tests
  const pricing: Line[] = [];
  for (const o of real) {
    const lines = Array.isArray(o.items) ? o.items : [];
    const listValue = lines.reduce((s, l) => s + (l.gift ? 0 : (Number(l.price) || 0) * Math.max(1, Number(l.quantity ?? l.qty ?? 1) || 1)), 0);
    const goodsNative = (Number(o.total) || 0) - (Number(o.shipping_cost) || 0);
    if (goodsNative > listValue + 0.01) pricing.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `стоката ${goodsNative.toFixed(2)} > сбора на редовете ${listValue.toFixed(2)} (отстъпката не е извадена?)` });
    if (goodsNative <= 0) pricing.push({ ref: ref(o), status: o.status, eur: 0, note: `стока ${goodsNative.toFixed(2)} (тотал ${o.total}, доставка ${o.shipping_cost})` });
    for (const l of lines) if (l.gift && Number(l.price) > 0) pricing.push({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `подарък с цена ${l.price}: ${l.name ?? l.slug}` });
  }
  const session = await getAdminSession();
  const ownerEmail = (session?.email ?? "").toLowerCase();
  const suspectedTests: Line[] = real.filter((o) => TEST_RE.test(`${o.name ?? ""} ${o.notes ?? ""} ${o.email ?? ""}`) || (!!ownerEmail && (o.email ?? "").toLowerCase() === ownerEmail))
    .map((o) => ({ ref: ref(o), status: o.status, eur: round2(goodsOf(o)), note: `${o.name ?? ""} · ${o.email ?? ""}${o.notes ? ` · ${String(o.notes).slice(0, 60)}` : ""}` }));

  // 5. Meta: live account spend vs synced rows
  const meta: { day: string; live: number; synced: number }[] = [];
  try {
    const sb = await adminDb();
    const live = await fetchAccountDailySpend(prevStart, today);
    const synced = new Map<string, number>();
    for (let from = 0; from < 50_000; from += 1000) {
      const q = await sb.from("meta_ad_insights").select("date, spend").gte("date", prevStart).lte("date", today).range(from, from + 999);
      if (q.error) { errors.push(`meta_ad_insights: ${q.error.message}`); break; }
      for (const r of (q.data ?? []) as { date: string; spend: number }[]) synced.set(String(r.date).slice(0, 10), (synced.get(String(r.date).slice(0, 10)) ?? 0) + (Number(r.spend) || 0));
      if ((q.data ?? []).length < 1000) break;
    }
    for (let d = prevStart; d <= today; d = shiftDay(d, -1)) meta.push({ day: d, live: round2(live.get(d) ?? 0), synced: round2(synced.get(d) ?? 0) });
  } catch (e) { errors.push(`Meta: ${e instanceof Error ? e.message : e}`); }
  const metaSum = (m: string) => ({ live: round2(meta.filter((x) => x.day.startsWith(m)).reduce((s, x) => s + x.live, 0)), synced: round2(meta.filter((x) => x.day.startsWith(m)).reduce((s, x) => s + x.synced, 0)) });

  // 6. e-mail problems (last 24 h)
  let emails: { at: string; type: string; recipient: string | null; subject: string | null; reason: string | null }[] = [];
  try {
    const sb = await adminDb();
    const q = await sb.from("email_events").select("created_at, type, recipient, subject, reason").gte("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString()).order("created_at", { ascending: false }).limit(50);
    emails = ((q.data ?? []) as { created_at: string; type: string; recipient: string | null; subject: string | null; reason: string | null }[]).map((r) => ({ at: r.created_at, type: r.type, recipient: r.recipient, subject: r.subject, reason: r.reason }));
  } catch { /* table missing */ }

  return {
    months: { cur, prev }, today,
    statuses: { cur: byStatus(cur), prev: byStatus(prev) },
    tab: { cur: tabMonth(cur), prev: tabMonth(prev) },
    excluded: { tests: tests.length, attempts: attempts.length, leads: leads.length },
    econt: { checked: withAwb.length, answered: raw.size, econtDeliveredNotCompleted, completedNotDeliveredInEcont, econtReturnedButLive, wrongMonth, shippedNoAwb, econtOrphans, econtCodDelivered, dateFixes: dateFixes.length },
    stripe: { paid: stripePaid, stripePaidNoOrder, stripePaidOrderNotSale, orderPaidNoStripe },
    pricing, suspectedTests,
    meta: { days: meta, cur: metaSum(cur), prev: metaSum(prev) },
    emails, errors,
  };
}

/** Owner only: set completed_at of Econt-delivered orders (this + last month) to Econt's real delivery time. Returns how many changed. */
export async function fixDeliveryDates(): Promise<number> {
  if ((await getAdminSession())?.role !== "owner") return 0;
  const sb = await adminDb();
  const prevStart = `${shiftDay(`${sofiaDay().slice(0, 7)}-01`, 1).slice(0, 7)}-01`;
  const rows = (await fetchOrders(sofiaMidnight(prevStart).toISOString())).filter((o) => o.status === "completed" && !isRo(o) && (o.tracking_number ?? "").trim());
  const raw = new Map<string, RawStatus>();
  const awbs = [...new Set(rows.map((o) => String(o.tracking_number).replace(/\s+/g, "")))];
  for (let i = 0; i < awbs.length; i += 50) for (const [k, v] of await getRawStatuses(awbs.slice(i, i + 50))) raw.set(k, v);
  let n = 0;
  for (const o of rows) {
    const r = raw.get(String(o.tracking_number).replace(/\s+/g, ""));
    const ms = r ? (r.deliveryTime ?? r.cdCollectedTime ?? null) : null;
    if (!r || rawVerdict(r) !== "delivered" || !ms || Number(ms) > Date.now()) continue;
    if (o.completed_at && Math.abs(new Date(o.completed_at).getTime() - Number(ms)) <= 60 * 60_000) continue;
    const { error } = await sb.from("orders").update({ completed_at: new Date(Number(ms)).toISOString() }).eq("id", o.id).eq("status", "completed");
    if (!error) n++;
  }
  return n;
}
