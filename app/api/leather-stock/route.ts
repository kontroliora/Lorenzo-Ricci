import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All stock (wallet_inventory, every product) in a single call, so a listing can show live "Изчерпан" without one fetch
// per card. Anon can read wallet_inventory (same as /api/stock/[slug]).
// Vercel's CDN keeps the answer 20 s and may serve it 30 s more while refreshing, so a sold-out product shows on every
// card within ~50 s while the function runs about twice a minute at most, whatever the traffic. Display only: the product
// page reads its own count live (/api/stock/[slug], never cached) and the order routes reserve stock atomically.
const CDN_CACHE = "public, max-age=0, s-maxage=20, stale-while-revalidate=30";

export async function GET() {
  const { data, error } = await supabase.from("wallet_inventory").select("slug, stock");
  if (error) {
    console.error("[leather-stock] error:", error.message);
    return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  const map: Record<string, number> = {};
  for (const r of (data ?? []) as { slug: string; stock: number }[]) map[r.slug] = r.stock;
  return NextResponse.json(map, { headers: { "Cache-Control": CDN_CACHE } });
}
