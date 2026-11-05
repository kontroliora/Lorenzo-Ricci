import { STOCK_TAG } from "@/lib/stock-tag";

// Server-side read of the free-to-sell count for one product (wallet_inventory, public SELECT
// for anon - the same number /api/stock/<slug> serves). Used where a statically generated page
// has to state availability in markup (product JSON-LD). Cached for an hour under STOCK_TAG:
// lib/stock-pages.ts rebuilds the page at once when the product sells out or comes back.
// Any failure returns null = "not known"; callers then fall back to the catalog's inStock.
export async function getLiveStock(slug: string): Promise<number | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/wallet_inventory?select=stock&slug=eq.${encodeURIComponent(slug)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 3600, tags: [STOCK_TAG] },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { stock: number }[];
    return typeof rows?.[0]?.stock === "number" ? rows[0].stock : null;
  } catch {
    return null;
  }
}
