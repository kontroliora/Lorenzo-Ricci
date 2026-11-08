import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { RESERVING_STATUSES_LEGACY } from "@/lib/order-status";
import { COLLECTION_BEST_SELLER_FALLBACK, NEW_COLLECTION_SLUGS, pieceLive } from "@/lib/new-collection";
import { getProductBySlug } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The women's collection's best sellers for the cart drawer's free-piece suggestion (owner, 08.11.2026): units sold per piece in
// real orders (new / confirmed / shipped / completed - never open or dead card attempts, cancellations or returns) of the last 14
// days, BG + RO together, gift lines left out; only pieces in the shop and in stock (wallet_inventory), most sold first.
// No sales (or any failure): the fallback piece alone. Vercel's CDN keeps the answer 1 hour. Display only: the drawer still checks
// live stock before suggesting anything.
const CDN_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=600";
const DAYS = 14;

export async function GET() {
  const fallback = { slugs: [COLLECTION_BEST_SELLER_FALLBACK], source: "fallback" as const };
  try {
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
    const [{ data: orders, error }, { data: stock }] = await Promise.all([
      supabaseAdmin().from("orders").select("items").in("status", [...RESERVING_STATUSES_LEGACY]).gte("created_at", since),
      supabase.from("wallet_inventory").select("slug, stock"),
    ]);
    if (error) throw new Error(error.message);
    const left = new Map(((stock ?? []) as { slug: string; stock: number }[]).map((r) => [r.slug, r.stock]));
    const sold = new Map<string, number>();
    for (const o of (orders ?? []) as { items: unknown }[]) {
      if (!Array.isArray(o.items)) continue;
      for (const it of o.items as { slug?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown }[]) {
        if (it.gift || typeof it.slug !== "string" || !NEW_COLLECTION_SLUGS.has(it.slug)) continue;
        const q = Math.max(0, Math.floor(Number(it.quantity ?? it.qty ?? 1)) || 0);
        sold.set(it.slug, (sold.get(it.slug) ?? 0) + q);
      }
    }
    const slugs = [...sold.entries()]
      .filter(([slug, n]) => n > 0 && pieceLive(slug) && !!getProductBySlug(slug)?.inStock && (left.get(slug) ?? 1) > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug);
    const body = slugs.length ? { slugs, source: "orders" as const } : fallback;
    return NextResponse.json(body, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (e) {
    console.error("[collection-best-seller]", e instanceof Error ? e.message : e);
    return NextResponse.json(fallback, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } });
  }
}
