import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { verifyCancelToken } from "@/lib/payment-token";
import { PENDING_PAYMENT } from "@/lib/payments";
import { expireOrder, markOrderPaid } from "@/lib/payment-orders";
import { notifyPaid } from "@/lib/payment-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The customer came back from the Stripe page without paying (cancel_url carries a signed token). Close the Stripe
// session and release the reserved stock right away, so a retry is not blocked by the customer's own unpaid hold.
// If the payment actually went through meanwhile, nothing is released: the order is marked paid instead.
export async function POST(req: NextRequest) {
  let body: { ref?: string; ct?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const ref = String(body.ref ?? "");
  if (!/^LR(RO)?-[A-Z0-9]{4,10}$/.test(ref) || !verifyCancelToken(ref, String(body.ct ?? ""))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data: o } = await sb.from("orders").select("status, stripe_session_id").eq("order_ref", ref).maybeSingle();
  if (!o || o.status !== PENDING_PAYMENT) return NextResponse.json({ ok: true, released: false });

  try {
    if (o.stripe_session_id) {
      const stripe = getStripe();
      let session = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
      if (session.status === "open") session = await stripe.checkout.sessions.expire(o.stripe_session_id);
      if (session.payment_status === "paid") {
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        const r = await markOrderPaid(sb, ref, { paymentIntent: pi, sessionId: session.id });
        if (r.kind === "paid") await notifyPaid(r.order, session.metadata ?? {});
        return NextResponse.json({ ok: true, released: false, paid: true });
      }
    }
    const row = await expireOrder(sb, ref, "expired");
    return NextResponse.json({ ok: true, released: !!row });
  } catch (e) {
    console.error("[order-payment/cancel] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 }); // the webhook / cron still release it later
  }
}
