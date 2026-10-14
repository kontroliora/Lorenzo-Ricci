// Romania market: which products are sold and how they read. Pure (no server imports) so client components can use it.
// The Bulgarian catalog (lib/products.ts) stays the single source of truth for everything that is not text or price;
// lib/ro/products-ro.ts only overlays the Romanian wording.
import { products } from "@/lib/products";
import type { Product } from "@/lib/types";
import { roEligible } from "./config";
import { RO_PRODUCTS } from "./products-ro";

export const RO_SLUGS: string[] = products.filter(roEligible).map((p) => p.slug);

/**
 * The product as the Romanian storefront shows it: Romanian text merged in, no crossed-out price and no sale badge
 * (the Romanian market has no price history, so no "old price" claim is made). `price` stays the EUR base price,
 * the figure the server validates; display RON with ronOf().
 */
export function localizeProduct(p: Product): Product {
  const t = RO_PRODUCTS[p.slug] ?? {};
  const { imageAlts, coverAlt, ...text } = t;
  const sale = typeof p.originalPrice === "number" && p.originalPrice > p.price;
  return {
    ...p,
    ...text,
    originalPrice: undefined,
    badge: sale && /REDUCERE|NAMALENIE|НАМАЛЕНИЕ/i.test(String(text.badge ?? p.badge ?? "")) ? undefined : (text.badge ?? p.badge),
    images: p.images.map((img, i) => ({ ...img, alt: imageAlts?.[i] ?? img.alt })),
    coverImage: { ...p.coverImage, alt: coverAlt ?? p.coverImage.alt },
  };
}

// Re-exported so server code can keep importing the helpers from here.
export { roEligible, ronOf, RO_CATEGORY_LABEL } from "./config";
