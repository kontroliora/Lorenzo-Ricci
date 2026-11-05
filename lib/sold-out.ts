// Slugs that cannot be bought right now: switched off in the catalogue (inStock: false - the owner's switch) or at 0 in
// wallet_inventory (the live ledger, public SELECT for anon, same source as /api/stock). Used to leave sold-out products
// out of recommendation spots (home sections, "Подобни продукти"); their own pages and the category listings still show
// "Изчерпан". The fetch is cached an hour under STOCK_TAG (same as lib/live-stock.ts); lib/stock-pages.ts rebuilds the
// pages at once when a product sells out or comes back. If the live read fails only the catalogue switch applies (fail open: nothing disappears by mistake).
import { products } from "@/lib/products";
import { STOCK_TAG } from "@/lib/stock-tag";

export async function getSoldOutSlugs(): Promise<string[]> {
  const out = new Set<string>(products.filter((p) => !p.inStock).map((p) => p.slug));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/wallet_inventory?select=slug,stock&stock=lte.0`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 3600, tags: [STOCK_TAG] },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) for (const r of (await res.json()) as { slug: string }[]) if (r?.slug) out.add(r.slug);
    } catch { /* keep the catalogue switch only */ }
  }
  return [...out];
}
