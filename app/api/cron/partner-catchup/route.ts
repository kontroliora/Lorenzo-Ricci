import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyPartnerOnce } from "@/lib/partner/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ONE-OFF (owner, 09.11.2026): the partner e-mails that failed between the partner deploy (o4cw1uk3p, 11:05:58 UTC) and
// partner_role.sql ("column orders.partner_email_sent_at does not exist": LR-H2W4AU72, LR-NZT5295X). Every order since the
// deploy with partner_email_sent_at still NULL goes through notifyPartnerOnce(), which itself skips non-jewellery / unpaid card
// orders, builds the correct badge and claims partner_email_sent_at (so never twice). Waits until the real partner is in
// `partners` and the self-test's test partner is gone (so nothing goes to the test address). Runs every minute until done.
const RUN_ID = "2026-11-09-a";
const SINCE = "2026-11-09T11:05:58.000Z";
const REAL = "dejvidvisev99@gmail.com";
const TEST = "dserbezov7@gmail.com";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const DONE = `partner-catchup:${RUN_ID}`;
  if (await kv.get(DONE)) return NextResponse.json({ ok: true, skipped: "done" });
  const sb = supabaseAdmin();
  const p = await sb.from("partners").select("email, enabled, notify").in("email", [REAL, TEST]);
  if (p.error) return NextResponse.json({ ok: false, waiting: `partners: ${p.error.message}` });
  const real = p.data?.find((r) => r.email === REAL);
  if (!real?.enabled || !real.notify || p.data?.some((r) => r.email === TEST)) return NextResponse.json({ ok: true, waiting: "real partner not invited yet / self-test running" });
  if (!(await kv.set(`${DONE}:lock`, 1, { nx: true, ex: 300 }))) return NextResponse.json({ ok: true, skipped: "running" });

  try {
    const q = await sb.from("orders").select("order_ref, created_at, payment_method, payment_status")
      .gte("created_at", SINCE).is("partner_email_sent_at", null).order("created_at");
    if (q.error) throw new Error(q.error.message);
    const results: { ref: string; at: string; pay: string; result: string }[] = [];
    for (const o of q.data ?? []) {
      results.push({ ref: o.order_ref, at: o.created_at, pay: `${o.payment_method}/${o.payment_status ?? "-"}`, result: await notifyPartnerOnce(o.order_ref) });
    }
    const failed = results.filter((r) => r.result === "failed").length;
    const out = { run: RUN_ID, since: SINCE, checked: results.length, sent: results.filter((r) => r.result === "sent"), others: results.filter((r) => r.result !== "sent"), failed };
    console.log("[partner-catchup]", JSON.stringify(out));
    if (!failed) await kv.set(DONE, { at: new Date().toISOString(), sent: out.sent.length }, { ex: 60 * 60 * 24 * 14 });
    return NextResponse.json(out);
  } finally {
    await kv.del(`${DONE}:lock`).catch(() => {});
  }
}
