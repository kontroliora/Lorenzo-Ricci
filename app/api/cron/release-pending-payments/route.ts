import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PENDING_PAYMENT, CARD_HOLD_MINUTES } from "@/lib/payments";
import { settlePending } from "@/lib/payment-orders";
import { alertTeam, notifyPaidOnce } from "@/lib/payment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Safety net for card orders. The Stripe webhook normally pays or expires an order; this sweeps what it never resolved:
//   1. every pending_payment order older than the hold time + a margin is looked up at Stripe (oldest first):
//        paid -> marked paid after all (e-mails / Meta Purchase follow); open -> session expired, order cancelled, stock back;
//        not found at Stripe -> cancelled; complete but unpaid (asynchronous payment in flight) -> left alone;
//   2. paid orders whose notifications never completed (a webhook that died half-way) are finished;
//   3. the team is alerted when an order has been pending for more than 2 hours (something is stuck).
// Vercel Cron (daily, vercel.json) and any external scheduler call it with Authorization: Bearer ${CRON_SECRET}.

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || !sameSecret(auth, cronSecret)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const cutoff = new Date(Date.now() - (CARD_HOLD_MINUTES + 10) * 60_000).toISOString();
  const { data, error } = await sb.from("orders").select("order_ref, stripe_session_id").eq("status", PENDING_PAYMENT).lt("created_at", cutoff).order("created_at", { ascending: true }).limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const out: { ref: string; result: string }[] = [];
  for (const o of data ?? []) {
    const ref = String(o.order_ref);
    try {
      const r = await settlePending(sb, ref, o.stripe_session_id);
      out.push({ ref, result: r.result === "released" ? "expired, stock released" : r.result });
    } catch (e) {
      console.error("[release-pending] failed for", ref, e);
      out.push({ ref, result: "error: " + (e instanceof Error ? e.message : String(e)) });
    }
  }

  // 2. paid, but the notifications never completed (older than 15 minutes, so the webhook that is still working is not raced)
  const paidCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const unnotified = await sb.from("orders").select("order_ref").eq("payment_status", "paid").is("notified_at", null).lt("paid_at", paidCutoff).order("paid_at", { ascending: true }).limit(20);
  for (const o of unnotified.data ?? []) {
    const ref = String(o.order_ref);
    try { out.push({ ref, result: `notifications: ${await notifyPaidOnce(sb, ref)}` }); }
    catch (e) { out.push({ ref, result: "notify error: " + (e instanceof Error ? e.message : String(e)) }); }
  }

  // 3. anything still pending after 2 hours is stuck: tell the team
  const stuckCutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const stuck = await sb.from("orders").select("order_ref").eq("status", PENDING_PAYMENT).lt("created_at", stuckCutoff).limit(10);
  if (stuck.data?.length) {
    await alertTeam("Поръчки с карта чакат плащане над 2 часа", `Още висят (наличността е блокирана): ${stuck.data.map((x) => x.order_ref).join(", ")}. Провери в Stripe и в логовете на cron-а.`);
  }
  return NextResponse.json({ ok: true, swept: out.length, results: out });
}
