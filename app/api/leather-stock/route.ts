import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All leather (wallet_inventory) stock in a single call, so a listing can show
// live "Изчерпан" without one fetch per card. Anon can read wallet_inventory
// (same as /api/stock/[slug]).
export async function GET() {
  const { data, error } = await supabase.from("wallet_inventory").select("slug, stock");
  if (error) {
    console.error("[leather-stock] error:", error.message);
    return NextResponse.json({}, { status: 200 });
  }
  const map: Record<string, number> = {};
  for (const r of (data ?? []) as { slug: string; stock: number }[]) map[r.slug] = r.stock;
  return NextResponse.json(map);
}
