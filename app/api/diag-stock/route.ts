import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only diagnostic — order-quantity breakdown by status per slug.
// Aggregate counts only, NO customer data. Token-guarded; remove after use.
const TOKEN = "d9x7k2m4qp";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slugFilter = req.nextUrl.searchParams.get("slug");
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("orders").select("items, status, excluded_from_stock");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const acc: Record<string, Record<string, number>> = {};
  for (const o of (data ?? []) as { items: { slug?: string; quantity?: number; qty?: number }[]; status: string; excluded_from_stock: boolean }[]) {
    const key = o.excluded_from_stock ? "fake" : o.status; // raw status, or "fake"
    for (const it of o.items ?? []) {
      const s = String(it.slug ?? ""); if (!s) continue;
      if (slugFilter && s !== slugFilter) continue;
      acc[s] ??= {};
      acc[s][key] = (acc[s][key] ?? 0) + Math.max(1, Number(it.quantity ?? it.qty ?? 1));
    }
  }
  return NextResponse.json(acc);
}
