import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY Stage-1 research — find orders whose stored total is below the
// expected goods value (price × quantity), i.e. possible underpricing / lost
// money on qty>1 orders. Order refs + first name only. Token-guarded; remove.
const TOKEN = "px9k2m4qz";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("orders").select("order_ref, name, items, total, status, excluded_from_stock, is_manual");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type It = { name?: string; slug?: string; price?: number; quantity?: number; qty?: number };
  type Row = { order_ref: string | null; name: string | null; items: It[]; total: number | null; status: string; excluded_from_stock: boolean; is_manual: boolean | null };
  const rows = ((data ?? []) as Row[]).filter((r) => !r.excluded_from_stock);

  const qtyOf = (it: It) => Math.max(1, Number(it.quantity ?? it.qty ?? 1));
  const flagged: unknown[] = [];
  const allMultiQty: unknown[] = [];

  for (const o of rows) {
    const items = Array.isArray(o.items) ? o.items : [];
    const expectedGoods = items.reduce((s, it) => s + (Number(it.price) || 0) * qtyOf(it), 0);
    const hasMultiQty = items.some((it) => qtyOf(it) > 1);
    const total = Number(o.total) || 0;
    const info = {
      ref: o.order_ref,
      name: (o.name || "").split(" ")[0],
      manual: !!o.is_manual,
      status: o.status,
      items: items.map((it) => `${it.name || it.slug} ×${qtyOf(it)} @€${it.price}`),
      expectedGoods: Math.round(expectedGoods * 100) / 100,
      storedTotal: total,
      diff: Math.round((total - expectedGoods) * 100) / 100,
    };
    if (hasMultiQty) allMultiQty.push(info);
    // Underpriced: total well below expected goods (beyond a normal ~15% discount).
    if (expectedGoods > 0 && total < expectedGoods * 0.85) flagged.push(info);
  }

  return NextResponse.json({
    totalChecked: rows.length,
    flaggedUnderpriced: flagged,
    allMultiQtyOrders: allMultiQty,
  });
}
