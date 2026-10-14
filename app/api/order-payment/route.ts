import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PENDING_PAYMENT } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Payment status of a card order, for the page the customer lands on after Stripe. The Stripe session id (only the
// customer's redirect carries it) is the key: without the matching ref + session id nothing is revealed.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const no = () => NextResponse.json({ status: "unknown" }, { headers: { "Cache-Control": "no-store" } });
  if (!/^LR(RO)?-[A-Z0-9]{4,10}$/.test(ref) || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return no();

  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("status, payment_status, payment_currency, total, items, stripe_session_id")
    .eq("order_ref", ref)
    .maybeSingle();
  if (error || !data || data.stripe_session_id !== sessionId) return no();

  const headers = { "Cache-Control": "no-store" };
  if (data.payment_status === "paid") {
    const items = ((Array.isArray(data.items) ? data.items : []) as { sku?: string; quantity?: number; qty?: number; gift?: boolean }[])
      .filter((i) => !i.gift && i.sku)
      .map((i) => ({ sku: String(i.sku), quantity: Number(i.quantity ?? i.qty ?? 1) }));
    return NextResponse.json({ status: "paid", total: Number(data.total ?? 0), currency: data.payment_currency === "RON" ? "RON" : "EUR", items }, { headers });
  }
  if (data.status === PENDING_PAYMENT) return NextResponse.json({ status: "pending" }, { headers });
  return NextResponse.json({ status: "expired" }, { headers });
}
