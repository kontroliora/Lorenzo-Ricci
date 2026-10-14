import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PENDING_PAYMENT, CARD_HOLD_MINUTES } from "@/lib/payments";
import { expireOrder, markOrderPaid } from "@/lib/payment-orders";
import { notifyPaid } from "@/lib/payment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Safety net for card orders. The Stripe webhook normally pays or expires an order; this sweeps the ones it never
// resolved (a missed webhook): every pending_payment order older than the hold time + a margin is looked up at Stripe:
//   paid  -> it is marked paid after all (and the usual e-mails / Meta Purchase follow)
//   open  -> the session is expired at Stripe, the order is cancelled and the reserved stock goes back
// Vercel Cron (daily, vercel.json) and any external scheduler call it with Authorization: Bearer ${CRON_SECRET}.

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || auth !== cronSecret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const cutoff = new Date(Date.now() - (CARD_HOLD_MINUTES + 10) * 60_000).toISOString();
  const { data, error } = await sb.from("orders").select("order_ref, stripe_session_id").eq("status", PENDING_PAYMENT).lt("created_at", cutoff).limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const out: { ref: string; result: string }[] = [];
  for (const o of data ?? []) {
    const ref = String(o.order_ref);
    try {
      if (!o.stripe_session_id) { await expireOrder(sb, ref, "failed"); out.push({ ref, result: "no session: released" }); continue; }
      const stripe = getStripe();
      let session = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
      if (session.status === "open") session = await stripe.checkout.sessions.expire(o.stripe_session_id);
      if (session.payment_status === "paid") {
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        const r = await markOrderPaid(sb, ref, { paymentIntent: pi, sessionId: session.id });
        if (r.kind === "paid") await notifyPaid(r.order, session.metadata ?? {});
        out.push({ ref, result: `paid (${r.kind})` });
      } else {
        const row = await expireOrder(sb, ref, "expired");
        out.push({ ref, result: row ? "expired, stock released" : "already handled" });
      }
    } catch (e) {
      console.error("[release-pending] failed for", ref, e);
      out.push({ ref, result: "error: " + (e instanceof Error ? e.message : String(e)) });
    }
  }
  return NextResponse.json({ ok: true, swept: out.length, results: out });
}
