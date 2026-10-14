// Romania market: which products are sold and how they read. Pure (no server imports) so client components can use it.
// The Bulgarian catalog (lib/products.ts) stays the single source of truth for everything that is not text or price;
// lib/ro/products-ro.ts only overlays the Romanian wording.
import { products } from "@/lib/products";
import type { Product } from "@/lib/types";
import { roEligible } from "./config";
import { RO_PRODUCTS } from "./products-ro";
import { roName } from "./names-ro";

export const RO_SLUGS: string[] = products.filter(roEligible).map((p) => p.slug);

/**
 * The product as the Romanian storefront shows it: Romanian text merged in. Sale prices and sale badges are kept as on the
 * Bulgarian site (owner, 2026-10-14); `price` / `originalPrice` stay EUR, the figures the server validates: show lei with
 * ronOf() / ronOriginalOf().
 */
export function localizeProduct(p: Product): Product {
  const t = RO_PRODUCTS[p.slug] ?? {};
  const { imageAlts, coverAlt, ...text } = t;
  return {
    ...p,
    ...text,
    name: roName(p),
    badge: text.badge ?? p.badge,
    images: p.images.map((img, i) => ({ ...img, alt: imageAlts?.[i] ?? img.alt })),
    coverImage: { ...p.coverImage, alt: coverAlt ?? p.coverImage.alt },
  };
}

// Re-exported so server code can keep importing the helpers from here.
export { roEligible, ronOf, ronOriginalOf, RO_CATEGORY_LABEL } from "./config";
