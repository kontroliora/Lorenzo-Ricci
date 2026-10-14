import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyCancelToken } from "@/lib/payment-token";
import { PENDING_PAYMENT } from "@/lib/payments";
import { settlePending } from "@/lib/payment-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The customer came back from the Stripe page without paying (cancel_url carries a signed token). Close the Stripe
// session and release the reserved stock right away, so a retry is not blocked by the customer's own unpaid hold.
// If the payment actually went through meanwhile, nothing is released: the order is marked paid instead. A payment that is
// still being confirmed by the bank (asynchronous) is left alone.
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
    const r = await settlePending(sb, ref, o.stripe_session_id);
    return NextResponse.json({ ok: true, released: r.released, ...(r.paid ? { paid: true } : {}) });
  } catch (e) {
    console.error("[order-payment/cancel] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 }); // the webhook / cron still release it later
  }
}
