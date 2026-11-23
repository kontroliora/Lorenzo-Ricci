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

  // A database hiccup is NOT a verdict on the payment: retry a few times, and if it still fails answer 503 - the success page then
  // keeps waiting (it treats a failed request as "pending") instead of telling a customer who has paid that the payment failed.
  type Row = { status: string; payment_status: string | null; payment_currency: string | null; total: number | null; items: unknown; stripe_session_id: string | null };
  let data: Row | null = null;
  let failed = true;
  for (const wait of [0, 300, 900, 2000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await supabaseAdmin()
        .from("orders")
        .select("status, payment_status, payment_currency, total, items, stripe_session_id")
        .eq("order_ref", ref)
        .maybeSingle();
      if (!res.error) { data = res.data as Row | null; failed = false; break; }
      console.error("[order-payment] lookup failed, retrying:", res.error.message);
    } catch (e) {
      console.error("[order-payment] lookup threw, retrying:", e instanceof Error ? e.message : e);
    }
  }
  if (failed) return NextResponse.json({ status: "retry" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!data || data.stripe_session_id !== sessionId) return no();

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
