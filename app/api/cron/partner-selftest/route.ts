// mail-policy: internal
import { NextRequest, NextResponse } from "next/server";
import { COLLECTION_PIECES } from "@/lib/new-collection";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PARTNER_COOKIE, signSession } from "@/lib/partner/access";
import { notifyPartnerOnce, sendPartnerLoginEmail } from "@/lib/partner/email";
import { issueLoginToken } from "@/lib/partner/access";
import { PARTNER_VIEW_KEYS, type PartnerOrderView } from "@/lib/partner/orders";

// ONE-OFF self-test of the partner role (owner, 09.11.2026). Runs once per RUN_ID (KV flag), from Vercel Cron:
//   1. a TEST partner (the owner's own address) + 5 test orders (COD jewellery, card PAID jewellery, mixed COD jewellery + watch,
//      card UNPAID jewellery, watch only), all marked "ТЕСТ" and excluded from stock;
//   2. the partner e-mail for each (only the first three may go out; a second call must not resend);
//   3. what the partner API returns, and the 403 checks (no cookie, forged cookie, other fields, delete, admin API, panel,
//      the database with the public key, the owner's toggle);
//   4. clean-up: the test orders and their partner state / log rows are deleted, the test partner is removed.
// The result is one log line "[partner-selftest]". Remove this route and its vercel.json entry afterwards.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RUN_ID = "2026-11-09-e";   // -a: before partner_role.sql; -b: COD test rows lacked payment_status (NOT NULL). Both stopped at step 1, nothing left behind. -c: 41/42, the test expected 24 pieces, the collection has 18. -d: 42/42, invite sent. -e: the partner sees the WHOLE order (all lines, full total), collection lines tagged; test e-mails only to the test address, no second invite.
const TEST_PARTNER = "dserbezov7@gmail.com";
const REAL_PARTNER = { email: "dejvidvisev99@gmail.com", name: "Партньор бижута" };   // invited only when every check passed
const TEST_CUSTOMER_EMAIL = "partner-selftest-customer@example.com";   // must never appear in anything the partner gets
const T = (s: string) => `LR-TST${s}`;

type Row = Record<string, unknown>;
const line = (slug: string, name: string, sku: string, price: number, quantity = 1) => ({ slug, name, sku, price, quantity, currency: "€" });
const VERDIS = line("necklace-verdis-gold", "Колие Verdis – Злато", "LR-N-VERDIS-G", 109);
const LUMEN = line("bracelet-lumen-silver", "Гривна Lumen – Сребро", "LR-B-LUMEN-S", 109);
const SPIRA = line("bracelet-spira-gold", "Гривна Spira – Злато", "LR-B-SPIRA-G", 115);
const WATCH = line("chrono-black", "Chrono Black", "LR-CHRONO-BLK", 119);

function testOrders(): Row[] {
  const base = {
    email: TEST_CUSTOMER_EMAIL, city: "София", post_code: "1000", courier: "econt", shipping_method: "econt-office",
    notes: "ТЕСТ партньор - автоматично се изтрива", excluded_from_stock: true, shipping_cost: 0,
  };
  return [
    // A: COD, two pieces -> the 1+1 makes one free: €109 to collect
    { ...base, order_ref: T("COD1"), name: "Тест Наложен", phone: "0888 111 111", address: "Еконт офис София Център", items: [VERDIS, LUMEN], subtotal: 109, total: 109, status: "new", payment_method: "cod", payment_status: "unpaid" },
    // B: card, PAID
    { ...base, order_ref: T("CARD1"), name: "Тест Карта", phone: "0888 222 222", address: "Еконт офис Пловдив", items: [SPIRA], subtotal: 115, total: 115, status: "confirmed", payment_method: "card", payment_status: "paid" },
    // C: mixed COD: jewellery + watch -> he sees only Verdis, €109 to collect (not the €228 order total)
    { ...base, order_ref: T("MIX1"), name: "Тест Смесена", phone: "0888 333 333", courier: "home", address: "ул. Тестова 1", items: [VERDIS, WATCH], subtotal: 228, total: 228, status: "new", payment_method: "cod", payment_status: "unpaid" },
    // D: card NOT paid -> nothing for him, no e-mail
    { ...base, order_ref: T("CARD2"), name: "Тест Неплатена", phone: "0888 444 444", items: [LUMEN], subtotal: 109, total: 109, status: "pending_payment", payment_method: "card", payment_status: "pending" },
    // E: watch only -> nothing for him
    { ...base, order_ref: T("WATCH1"), name: "Тест Часовник", phone: "0888 555 555", items: [WATCH], subtotal: 119, total: 119, status: "new", payment_method: "cod", payment_status: "unpaid" },
  ];
}
const REFS = testOrders().map((o) => String(o.order_ref));

async function cleanup(): Promise<void> {
  const sb = supabaseAdmin();
  await sb.from("partner_status_log").delete().in("order_ref", REFS);
  await sb.from("partner_order_state").delete().in("order_ref", REFS);
  await sb.from("orders").delete().in("order_ref", REFS);
  await sb.from("partners").delete().eq("email", TEST_PARTNER);
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const DONE = `partner-selftest:${RUN_ID}`;
  if (await kv.get(DONE)) return NextResponse.json({ ok: true, skipped: "done" });
  if (!(await kv.set(`${DONE}:lock`, 1, { nx: true, ex: 300 }))) return NextResponse.json({ ok: true, skipped: "running" });

  const origin = "https://www.lorenzo-ricci.com";
  const sb = supabaseAdmin();
  const checks: { name: string; ok: boolean; got?: unknown }[] = [];
  const check = (name: string, ok: boolean, got?: unknown) => checks.push({ name, ok, ...(ok ? {} : { got }) });
  const seen: Record<string, PartnerOrderView | null> = {};
  try {
    await cleanup();
    // notify false: a real order during the test must not reach the test address; the test's own e-mails go to it explicitly
    const p = await sb.from("partners").insert({ email: TEST_PARTNER, name: "ТЕСТ партньор", enabled: true, notify: false, invited_at: new Date().toISOString() });
    if (p.error) throw new Error(`partners: ${p.error.message}`);
    const ins = await sb.from("orders").insert(testOrders(), { defaultToNull: false });   // a key missing in one row = column default, not NULL
    if (ins.error) throw new Error(`orders: ${ins.error.message}`);

    // ── e-mails ──
    const mail: Record<string, string> = {};
    const onlyTest = { to: [TEST_PARTNER] };   // never the real partner (he is a recipient since run -d)
    for (const ref of REFS) mail[ref] = await notifyPartnerOnce(ref, onlyTest);
    mail[`${T("COD1")} (2nd call)`] = await notifyPartnerOnce(T("COD1"), onlyTest);
    check("e-mail COD sent", mail[T("COD1")] === "sent", mail[T("COD1")]);
    check("e-mail card PAID sent", mail[T("CARD1")] === "sent", mail[T("CARD1")]);
    check("e-mail mixed sent", mail[T("MIX1")] === "sent", mail[T("MIX1")]);
    check("e-mail card UNPAID not sent", mail[T("CARD2")] === "not-paid", mail[T("CARD2")]);
    check("e-mail watch-only not sent", mail[T("WATCH1")] === "not-jewellery", mail[T("WATCH1")]);
    check("e-mail never twice", mail[`${T("COD1")} (2nd call)`] === "already-sent", mail[`${T("COD1")} (2nd call)`]);

    // ── the partner API, as the partner ──
    const cookie = `${PARTNER_COOKIE}=${signSession(TEST_PARTNER)}`;
    const call = async (path: string, init: RequestInit & { asPartner?: boolean; cookieValue?: string } = {}) => {
      const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
      if (init.cookieValue !== undefined) headers.cookie = init.cookieValue;
      else if (init.asPartner !== false) headers.cookie = cookie;
      const r = await fetch(origin + path, { ...init, headers, redirect: "manual", cache: "no-store" });
      const text = await r.text();
      let json: unknown = null; try { json = JSON.parse(text); } catch { /* html */ }
      return { status: r.status, json, text, location: r.headers.get("location") };
    };

    const list = await call("/api/partner/orders?filter=all");
    check("list: 200", list.status === 200, list.status);
    const orders = ((list.json as { orders?: PartnerOrderView[] })?.orders ?? []);
    for (const ref of REFS) seen[ref] = orders.find((o) => o.ref === ref) ?? null;
    check("list: COD, card PAID, mixed shown", !!seen[T("COD1")] && !!seen[T("CARD1")] && !!seen[T("MIX1")]);
    check("list: card UNPAID hidden", !seen[T("CARD2")]);
    check("list: watch-only hidden", !seen[T("WATCH1")]);
    check("list: only allowed keys", orders.every((o) => Object.keys(o).every((k) => PARTNER_VIEW_KEYS.includes(k))));
    check("list: no customer e-mail anywhere", !list.text.includes("@") && !/\"email\"/.test(list.text));
    const mix = seen[T("MIX1")];
    check("mixed: BOTH lines (Verdis + the watch)", mix?.items.length === 2 && mix.items[0].model === "Колие Verdis" && mix.items[1].model === "Chrono Black", mix?.items);
    check("mixed: Verdis tagged Дамска колекция, the watch not", mix?.items[0]?.collection === true && mix?.items[1]?.collection === false, mix?.items);
    check("mixed: full total €228, collect €228", mix?.total === 228 && mix?.payment.collect === 228 && mix?.payment.label === "НАЛОЖЕН ПЛАТЕЖ — €228.00", { total: mix?.total, payment: mix?.payment });
    check("COD: 1+1 discount €109, total + collect €109", seen[T("COD1")]?.discount === 109 && seen[T("COD1")]?.total === 109 && seen[T("COD1")]?.payment.collect === 109, seen[T("COD1")]);
    check("card: ПЛАТЕНО С КАРТА, total €115, collect 0", seen[T("CARD1")]?.payment.label === "ПЛАТЕНО С КАРТА" && seen[T("CARD1")]?.total === 115 && seen[T("CARD1")]?.payment.collect === 0, seen[T("CARD1")]?.payment);

    const pieces = await call("/api/partner/jewellery");
    const pcs = (pieces.json as { pieces?: unknown[] })?.pieces ?? [];
    check(`Бижута: 200 with all ${COLLECTION_PIECES.length} pieces`, pieces.status === 200 && pcs.length === COLLECTION_PIECES.length, { status: pieces.status, n: pcs.length });

    const set = await call(`/api/partner/orders/${T("COD1")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "called", note: "тест бележка" }) });
    check("status Обадено + note: 200", set.status === 200 && (set.json as { order?: PartnerOrderView })?.order?.state.status === "called", set.status);
    const logRows = await sb.from("partner_status_log").select("old_status, new_status, new_note, email").eq("order_ref", T("COD1"));
    check("status change logged", logRows.data?.length === 1 && logRows.data[0].new_status === "called" && logRows.data[0].email === TEST_PARTNER, logRows.data);
    const ordStatus = await sb.from("orders").select("status").eq("order_ref", T("COD1")).single();
    check("store order status untouched", ordStatus.data?.status === "new", ordStatus.data);

    // ── 403 checks ──
    const j = { "Content-Type": "application/json" };
    const s403 = async (name: string, path: string, init: Parameters<typeof call>[1] = {}) => {
      const r = await call(path, init);
      check(`403: ${name}`, r.status === 403, { status: r.status, location: r.location });
      return r.status;
    };
    await s403("list without a session", "/api/partner/orders?filter=all", { asPartner: false });
    await s403("forged cookie", "/api/partner/orders?filter=all", { cookieValue: `${PARTNER_COOKIE}=eyJlIjoiZHNlcmJlem92N0BnbWFpbC5jb20iLCJpYXQiOjEsImV4cCI6OTk5OTk5OTk5OTk5OX0.AAAA` });
    await s403("status on a watch-only order", `/api/partner/orders/${T("WATCH1")}`, { method: "POST", headers: j, body: JSON.stringify({ status: "called" }) });
    await s403("status on an unpaid card order", `/api/partner/orders/${T("CARD2")}`, { method: "POST", headers: j, body: JSON.stringify({ status: "called" }) });
    await s403("read a watch-only order", `/api/partner/orders/${T("WATCH1")}`);
    await s403("change another field (total)", `/api/partner/orders/${T("COD1")}`, { method: "POST", headers: j, body: JSON.stringify({ status: "confirmed", total: 1 }) });
    await s403("delete an order", `/api/partner/orders/${T("COD1")}`, { method: "DELETE" });
    await s403("unknown partner API", "/api/partner/customers");
    await s403("admin API: inventory", "/api/admin/inventory");
    await s403("admin API: price change", "/api/admin/products/discount", { method: "POST", headers: j, body: "{}" });
    await s403("admin panel: orders", "/lr-panel-v8m3q/orders");
    await s403("admin panel: revenue", "/lr-panel-v8m3q/revenue");
    await s403("admin panel: customers", "/lr-panel-v8m3q/customers");
    const bad = await call(`/api/partner/orders/${T("COD1")}`, { method: "POST", headers: j, body: JSON.stringify({ status: "shipped" }) });
    check("status outside his four: refused", bad.status === 400, bad.status);

    // the database with the public key (what a browser could try): no partner table opens
    const anon = (process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
    const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    for (const t of ["partners", "partner_order_state", "partner_status_log"]) {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=5`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: "no-store" });
      const body = await r.text();
      check(`database (public key): ${t} closed`, r.status === 401 || r.status === 403 || body.trim() === "[]", { status: r.status, body: body.slice(0, 120) });
    }

    // pages
    const page = await call("/partner");
    check("/partner page: 200 for him", page.status === 200, page.status);
    const pageAnon = await call("/partner", { asPartner: false });
    check("/partner without a session -> sign-in", pageAnon.status >= 300 && pageAnon.status < 400 && String(pageAnon.location).includes("/partner/login"), { status: pageAnon.status, location: pageAnon.location });

    // the owner's toggle
    await sb.from("partners").update({ enabled: false, revoked_before: new Date().toISOString() }).eq("email", TEST_PARTNER);
    await s403("after the owner switched him off", "/api/partner/orders?filter=all");
    await sb.from("partners").update({ enabled: true }).eq("email", TEST_PARTNER);
    await s403("old session after switching back on (revoked)", "/api/partner/orders?filter=all");
    const fresh = await call("/api/partner/orders?filter=new", { cookieValue: `${PARTNER_COOKIE}=${signSession(TEST_PARTNER, Date.now() + 1000)}` });
    check("new session after switching back on: 200", fresh.status === 200, fresh.status);
  } catch (e) {
    check("run", false, e instanceof Error ? e.message : String(e));
  } finally {
    await cleanup().catch((e) => check("cleanup", false, String(e)));
    await kv.del(`${DONE}:lock`).catch(() => {});
  }
  const failed = checks.filter((c) => !c.ok);
  // 5. every check passed: the real partner is added and gets his invitation (owner: "then deploy and send him the invite")
  let invite = "not sent (a check failed)";
  const already = await sb.from("partners").select("invited_at").eq("email", REAL_PARTNER.email).maybeSingle();
  if (already.data?.invited_at) invite = `not resent: ${REAL_PARTNER.email} was invited at ${already.data.invited_at}`;
  else if (!failed.length) {
    try {
      const up = await sb.from("partners").upsert({ email: REAL_PARTNER.email, name: REAL_PARTNER.name, enabled: true, notify: true, invited_at: new Date().toISOString() }, { onConflict: "email" });
      if (up.error) throw new Error(up.error.message);
      await sendPartnerLoginEmail(REAL_PARTNER.email, await issueLoginToken(REAL_PARTNER.email, "invite"), true);
      invite = `sent to ${REAL_PARTNER.email}`;
    } catch (e) { invite = `FAILED: ${e instanceof Error ? e.message : String(e)}`; }
  }
  const result = { run: RUN_ID, passed: checks.length - failed.length, failed: failed.length, invite, checks, views: seen };
  console.log("[partner-selftest]", JSON.stringify(result));
  await kv.set(DONE, { at: new Date().toISOString(), passed: result.passed, failed: result.failed }, { ex: 60 * 60 * 24 * 7 });
  return NextResponse.json(result);
}
