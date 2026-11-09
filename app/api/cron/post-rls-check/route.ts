import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ONE-OFF (owner, 09.11.2026), after rls_lockdown_2_policies.sql: what the server still does with the service role. The health
// checks (site / checkout / e-mail / synthetic order), the latest order-history rows (who changed what: the admin's e-mail must
// still be there), the latest orders and their e-mails, and one Telegram test message. Logged once as [post-rls-check].
const RUN = "post-rls-check:2026-11-09-a";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await kv.get(RUN)) return NextResponse.json({ ok: true, skipped: "done" });
  await kv.set(RUN, 1, { ex: 60 * 60 * 24 * 7 });
  const sb = supabaseAdmin();
  const [health, log, orders] = await Promise.all([
    sb.from("health_status").select("key, ok, detail, checked_at").order("key"),
    sb.from("order_status_log").select("order_id, old_status, new_status, changed_by, changed_by_email, changed_at").order("changed_at", { ascending: false }).limit(15),
    sb.from("orders").select("order_ref, created_at, payment_method, payment_status, status, notified_at, partner_email_sent_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const tg = await sendTelegram("✅ <b>Lorenzo Ricci</b>: тест след заключването на базата (RLS). Известията работят.");
  const out = {
    health: health.error ? health.error.message : (health.data ?? []).filter((h) => !h.key.startsWith("_")).map((h) => ({ key: h.key, ok: h.ok, at: h.checked_at, detail: h.ok ? undefined : h.detail })),
    history: log.error ? log.error.message : log.data,
    orders: orders.error ? orders.error.message : orders.data,
    telegram: tg,
  };
  console.log("[post-rls-check]", JSON.stringify(out));
  return NextResponse.json(out);
}
