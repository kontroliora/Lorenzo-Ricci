import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { modeOfKey } from "./stripe-mode";
import { ANY_ORDER_REF_RE } from "./order-ref";
import { markOrderPaid } from "./payment-orders";
import { notifyPaidOnce, alertTeam } from "./payment-notify";

// Stripe -> orders reconciliation (24.10.2026). The webhook is the normal path; this is the net under it:
//   1. every PAID Checkout Session of the last `days` days (this shop's references only) is matched to its order by reference;
//      an order that is not marked paid is paid now (markOrderPaid: same rules as the webhook - pending, late, refund if the stock
//      is gone) and, where the order was not a pending card order at all, its payment fields are written directly:
//      payment_method = card, payment_status = paid, stripe_payment_intent, stripe_session_id, paid_at;
//   2. a paid session with an LR reference but no order            -> listed (orphan payment);
//   3. a live card order (new / confirmed / shipped / completed) without a paid payment -> listed;
//   4. an order marked paid whose Stripe session is not paid       -> listed.
// The team gets ONE e-mail when something was fixed, and an e-mail for each problem the first time it is seen
// (stripe_events keeps "reconcile:..." rows as the memory, so a problem is not mailed every 15 minutes).
// Safe to run any number of times: every write is conditional and repeats are no-ops.

export type ReconcileReport = {
  checkedSessions: number;
  fixed: { ref: string; paymentIntent: string | null; result: string }[];
  orphans: { sessionId: string; ref: string; amount: number; currency: string; paymentIntent: string | null; created: string }[];
  cardWithoutPayment: { ref: string; status: string; paymentStatus: string | null }[];
  paidWithoutStripe: { ref: string; sessionId: string | null; stripeState: string }[];
  errors: string[];
};

type Row = {
  order_ref: string; status: string; payment_method: string | null; payment_status: string | null;
  stripe_session_id: string | null; stripe_payment_intent: string | null; paid_at: string | null; created_at: string;
};
const COLS = "order_ref, status, payment_method, payment_status, stripe_session_id, stripe_payment_intent, paid_at, created_at";
const LIVE = ["new", "confirmed", "shipped", "completed"];

const piOf = (v: string | Stripe.PaymentIntent | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);
const refOf = (s: Stripe.Checkout.Session): string | null => {
  const ref = s.metadata?.order_ref ?? s.client_reference_id ?? null;
  return ref && ANY_ORDER_REF_RE.test(ref) ? ref : null;
};

/** true only the first time `key` is seen (stripe_events is the memory). A read/write problem counts as "new": better one e-mail too many. */
async function firstTime(sb: SupabaseClient, key: string, ref: string | null, result: string): Promise<boolean> {
  const { data, error } = await sb.from("stripe_events")
    .upsert({ event_id: key, type: "reconcile", order_ref: ref, result }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

export async function reconcileStripe(sb: SupabaseClient, opts: { days?: number; alert?: boolean } = {}): Promise<ReconcileReport> {
  const days = Math.min(Math.max(opts.days ?? 7, 1), 60);
  const report: ReconcileReport = { checkedSessions: 0, fixed: [], orphans: [], cardWithoutPayment: [], paidWithoutStripe: [], errors: [] };
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) { report.errors.push("STRIPE_SECRET_KEY is not set"); return report; }
  const live = modeOfKey(key) === "live";
  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const paidSessions = new Set<string>();

  // 1 + 2: Stripe -> orders
  for await (const s of stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 })) {
    if (s.livemode !== live) continue;
    const ref = refOf(s);
    if (!ref || s.payment_status !== "paid") continue;
    report.checkedSessions++;
    paidSessions.add(s.id);
    const pi = piOf(s.payment_intent);
    try {
      const { data, error } = await sb.from("orders").select(COLS).eq("order_ref", ref).maybeSingle();
      if (error) throw new Error(error.message);
      const order = data as Row | null;
      if (!order) {
        report.orphans.push({ sessionId: s.id, ref, amount: (s.amount_total ?? 0) / 100, currency: String(s.currency ?? "").toUpperCase(), paymentIntent: pi, created: new Date(s.created * 1000).toISOString() });
        continue;
      }
      if (order.stripe_session_id && order.stripe_session_id !== s.id) {
        // Another session of the same order (a retried checkout) - only the order's own session decides.
        continue;
      }
      // Refunded: a Checkout Session stays "paid" after a refund - never turn a refunded order back into a paid one.
      if (order.payment_status === "refunded") continue;
      const needsMethod = order.payment_method !== "card";
      if (order.payment_status === "paid" && !needsMethod) {
        // Paid already: only fill a missing payment intent / paid time (never overwrite).
        const fill: Record<string, string> = {};
        if (!order.stripe_payment_intent && pi) fill.stripe_payment_intent = pi;
        if (!order.paid_at) fill.paid_at = new Date((s.created ?? since) * 1000).toISOString();
        if (Object.keys(fill).length) {
          await sb.from("orders").update(fill).eq("order_ref", ref);
          report.fixed.push({ ref, paymentIntent: pi, result: `filled ${Object.keys(fill).join(", ")}` });
        }
        continue;
      }
      const r = await markOrderPaid(sb, ref, { paymentIntent: pi, sessionId: s.id });
      if (r.kind === "paid") {
        report.fixed.push({ ref, paymentIntent: pi, result: r.late ? "marked paid (late payment, stock re-reserved)" : "marked paid" });
        await notifyPaidOnce(sb, ref, s.metadata ?? {});
        continue;
      }
      if (r.kind === "refunded") { report.fixed.push({ ref, paymentIntent: pi, result: "paid after expiry, stock gone: refunded in Stripe" }); continue; }
      if (r.kind === "mismatch" || r.kind === "unknown") { report.errors.push(`${ref}: ${r.kind}`); continue; }
      // "already": markOrderPaid only moves pending card orders. Anything else that Stripe says is paid (a COD row, a row with a
      // wrong payment status) gets the payment written directly - the money IS at Stripe, the courier must collect nothing.
      const now = r.order as unknown as Row;
      if (now.payment_status !== "paid" || now.payment_method !== "card") {
        const patch = {
          payment_method: "card", payment_status: "paid", stripe_session_id: s.id,
          ...(pi ? { stripe_payment_intent: pi } : {}),
          paid_at: now.paid_at ?? new Date((s.created ?? since) * 1000).toISOString(),
        };
        const { error: upErr } = await sb.from("orders").update(patch).eq("order_ref", ref);
        if (upErr) throw new Error(upErr.message);
        report.fixed.push({ ref, paymentIntent: pi, result: `payment written (was ${now.payment_method ?? "?"} / ${now.payment_status ?? "?"}, status ${now.status})` });
        await notifyPaidOnce(sb, ref, s.metadata ?? {});
      }
    } catch (e) {
      report.errors.push(`${ref}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3 + 4: orders -> Stripe
  const sinceIso = new Date(since * 1000).toISOString();
  const { data: rows, error: rowsErr } = await sb.from("orders").select(COLS).gte("created_at", sinceIso)
    .or("payment_method.eq.card,payment_status.eq.paid");
  if (rowsErr) report.errors.push(`orders read: ${rowsErr.message}`);
  for (const o of (rows ?? []) as Row[]) {
    const paid = o.payment_status === "paid";
    if (o.payment_method === "card" && !paid && LIVE.includes(o.status)) {
      report.cardWithoutPayment.push({ ref: o.order_ref, status: o.status, paymentStatus: o.payment_status });
      continue;
    }
    if (paid && !(o.stripe_session_id && paidSessions.has(o.stripe_session_id))) {
      let state = "no session id on the order";
      if (o.stripe_session_id) {
        try {
          const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
          if (s.payment_status === "paid") continue;                 // older than the window or another listing page: fine
          state = `session ${s.status} / ${s.payment_status}`;
        } catch (e) { state = `session not found (${e instanceof Error ? e.message : "error"})`; }
      }
      report.paidWithoutStripe.push({ ref: o.order_ref, sessionId: o.stripe_session_id, stripeState: state });
    }
  }

  if (opts.alert !== false) await alertOnce(sb, report);
  return report;
}

async function alertOnce(sb: SupabaseClient, r: ReconcileReport): Promise<void> {
  const lines: string[] = [];
  if (r.fixed.length) {
    lines.push("ПОПРАВЕНИ (платени в Stripe, но не бяха отбелязани в панела):");
    for (const f of r.fixed) lines.push(`  ${f.ref} - ${f.result}${f.paymentIntent ? ` (${f.paymentIntent})` : ""}`);
    lines.push("Тези поръчки са ПЛАТЕНИ С КАРТА: наложен платеж 0.");
  }
  const fresh = async <T,>(list: T[], keyOf: (x: T) => string, refOfX: (x: T) => string | null, label: string, fmt: (x: T) => string) => {
    const out: string[] = [];
    for (const x of list) if (await firstTime(sb, `reconcile:${keyOf(x)}`, refOfX(x), label)) out.push(fmt(x));
    if (out.length) { lines.push("", label); lines.push(...out); }
  };
  await fresh(r.orphans, (x) => `orphan:${x.sessionId}`, (x) => x.ref, "ПЛАЩАНЕ БЕЗ ПОРЪЧКА (провери в Stripe):", (x) => `  ${x.ref} - ${x.amount.toFixed(2)} ${x.currency}, ${x.created}, ${x.paymentIntent ?? x.sessionId}`);
  await fresh(r.cardWithoutPayment, (x) => `nopay:${x.ref}:${x.status}`, (x) => x.ref, "КАРТА, НО НЯМА ПЛАЩАНЕ (не изпращай):", (x) => `  ${x.ref} - статус ${x.status}, плащане ${x.paymentStatus ?? "-"}`);
  await fresh(r.paidWithoutStripe, (x) => `nostripe:${x.ref}`, (x) => x.ref, "ОТБЕЛЯЗАНА ПЛАТЕНА, НО STRIPE НЕ ПОТВЪРЖДАВА:", (x) => `  ${x.ref} - ${x.stripeState}`);
  if (!lines.length) return;
  const subject = r.fixed.length ? `Сверка със Stripe: поправени ${r.fixed.length} поръчки` : "Сверка със Stripe: има несъответствие";
  await alertTeam(subject, lines.join("\n"));
}

// The orders page runs a short reconciliation before it reads the board (at most once every 3 minutes per server instance, at
// most 4 seconds): whoever opens the panel to ship sees the payment Stripe has, even if the webhook and the cron both missed it.
let lastPanelRun = 0;
export async function reconcileBeforePanel(sb: SupabaseClient): Promise<void> {
  if (Date.now() - lastPanelRun < 3 * 60_000) return;
  lastPanelRun = Date.now();
  try {
    await Promise.race([
      reconcileStripe(sb, { days: 3 }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch (e) {
    console.error("[stripe-reconcile] panel run failed:", e instanceof Error ? e.message : e);
  }
}
