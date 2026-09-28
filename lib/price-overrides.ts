import { unstable_cache } from "next/cache";
import type { Product } from "./types";
import { supabaseAdmin } from "./supabase-admin";

// Durable price overrides — see supabase/product_price_overrides.sql for the full
// rationale. Row present for a slug = that product is on sale; absent = the plain
// lib/products.ts catalog price. This is the ONE place that reads the table; every
// server entry point below merges its result onto the static catalog instead of
// each reaching into Supabase itself.
//
// lib/products.ts itself (`products`, `getProductBySlug`, etc.) stays synchronous —
// it remains the static ground truth for everything except price/originalPrice, and
// every client component that imports it keeps working unchanged. Overrides are
// merged in only at the async, request-time entry points (page.tsx files and the
// order routes) via applyOverride(s) below.
//
// The storefront pages stay statically generated (no force-dynamic) — this is cached
// with Next's Data Cache under PRICE_OVERRIDES_TAG so the admin discount route can
// call revalidateTag/revalidatePath after a write and get an on-demand ISR refresh
// of exactly the affected routes, instead of paying per-request Supabase reads.

export type PriceOverride = { price: number; originalPrice: number };

export const PRICE_OVERRIDES_TAG = "price-overrides";

// unstable_cache's Data Cache entry can't hold a Map, so the cached function returns
// a plain record and getPriceOverrides() below rebuilds the Map every call (cheap).
const fetchPriceOverrides = unstable_cache(
  async (): Promise<Record<string, PriceOverride>> => {
    const out: Record<string, PriceOverride> = {};
    try {
      const { data, error } = await supabaseAdmin()
        .from("product_price_overrides")
        .select("slug, price, original_price");
      if (error) {
        // Fail OPEN to catalog prices rather than break the storefront if the table
        // or the network hiccups — worst case a sale doesn't show, nothing crashes.
        console.error("[price-overrides] fetch failed:", error.message);
        return out;
      }
      for (const row of data ?? []) {
        const slug = row.slug as string;
        const price = Number(row.price);
        const originalPrice = Number(row.original_price);
        if (!slug || !Number.isFinite(price) || !Number.isFinite(originalPrice)) continue;
        out[slug] = { price, originalPrice };
      }
    } catch (err) {
      console.error("[price-overrides] fetch threw:", err);
    }
    return out;
  },
  ["price-overrides"],
  { tags: [PRICE_OVERRIDES_TAG] }
);

export async function getPriceOverrides(): Promise<Map<string, PriceOverride>> {
  return new Map(Object.entries(await fetchPriceOverrides()));
}

// Shallow-clones only the price fields — every other field (name/images/specs/stock/
// etc.) stays the same value, so components that only care about those see no change.
export function applyOverride<T extends Product>(product: T, overrides: Map<string, PriceOverride>): T {
  const ov = overrides.get(product.slug);
  if (!ov) return product;
  return { ...product, price: ov.price, originalPrice: ov.originalPrice };
}

export function applyOverrides<T extends Product>(list: T[], overrides: Map<string, PriceOverride>): T[] {
  if (overrides.size === 0) return list;
  return list.map((p) => applyOverride(p, overrides));
}
