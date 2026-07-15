import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY Stage-1 research — aggregate order counts + revenue by status, to see
// the real picture behind Meta's inflated Purchase count. Counts/sums only, no
// customer data. Token-guarded; remove after use.
const TOKEN = "roas8k3m2x";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("orders").select("status, total, excluded_from_stock, cancel_category, return_kind, created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { status: string; total: number | null; excluded_from_stock: boolean; cancel_category: string | null; return_kind: string | null; created_at: string };
  const rows = (data ?? []) as Row[];
  const real = rows.filter((r) => !r.excluded_from_stock);

  const byStatus: Record<string, { count: number; revenue: number }> = {};
  for (const r of real) {
    const k = r.status ?? "?";
    byStatus[k] ??= { count: 0, revenue: 0 };
    byStatus[k].count++;
    byStatus[k].revenue += Number(r.total) || 0;
  }
  const cancelBy: Record<string, number> = {};
  for (const r of real.filter((r) => r.status === "cancelled")) {
    const k = r.cancel_category ?? "—";
    cancelBy[k] = (cancelBy[k] ?? 0) + 1;
  }
  const returnBy: Record<string, number> = {};
  for (const r of real.filter((r) => r.status === "returned")) {
    const k = r.return_kind ?? "некласифициран";
    returnBy[k] = (returnBy[k] ?? 0) + 1;
  }

  const dates = real.map((r) => r.created_at).filter(Boolean).sort();
  return NextResponse.json({
    totalOrders: real.length,
    fake: rows.length - real.length,
    grossRevenue: Math.round(real.reduce((s, r) => s + (Number(r.total) || 0), 0) * 100) / 100,
    byStatus,
    cancelBy,
    returnBy,
    firstOrder: dates[0] ?? null,
    lastOrder: dates[dates.length - 1] ?? null,
  });
}
