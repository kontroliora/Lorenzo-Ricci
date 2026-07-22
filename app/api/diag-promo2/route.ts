import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only verification that orders_promo.sql took effect. ZERO writes.
const TOKEN = "pv7k2m9x";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  // 1) do the columns exist now?
  const probe = await sb.from("orders").select("promo_code, promo_discount").limit(1);

  // 2) the exact top tier getOrders() uses — it must no longer fall back
  const TOP = "id, order_ref, name, phone, city, post_code, address, shipping_method, courier, items, total, notes, status, call_state, call_notes, call_attempts, tracking_number, excluded_from_stock, created_at, last_attempt_at, call_attempt_times, return_reviewed, is_manual, cancel_category, cancel_reason, promo_code, promo_discount, return_kind, return_dwell_days, returning_at, restocked_at, restocked_source";
  const tier = await sb.from("orders").select(TOP).limit(1);

  // 3) current values (expect null — no backfill was run)
  const one = await sb.from("orders").select("order_ref, subtotal, total, promo_code, promo_discount").eq("order_ref", "LR-W2LII0").single();
  const filled = await sb.from("orders").select("id", { count: "exact", head: true }).not("promo_code", "is", null);

  return NextResponse.json({
    columnsExist: !probe.error,
    columnsError: probe.error?.message ?? null,
    panelTopTierWorks: !tier.error,
    panelTierError: tier.error?.message ?? null,
    sampleOrder: one.data ?? one.error?.message,
    ordersWithCodeStored: filled.count ?? 0,
  });
}
