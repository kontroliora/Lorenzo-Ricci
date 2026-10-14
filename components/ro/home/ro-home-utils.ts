import type { Product } from "@/lib/types";

// Small pure helpers shared by the Romanian home sections (no React, no server imports: client components use it).

// Defence in depth: the Romanian storefront must never print Bulgarian wording if an overlay entry is missing.
// Cyrillic block U+0400-U+04FF, tested by code point so no Cyrillic literal sits in this file.
export const hasCyrillic = (text: string): boolean =>
  Array.from(text).some((ch) => { const c = ch.charCodeAt(0); return c >= 0x400 && c <= 0x4ff; });

/** The text when it is safe to show on a Romanian page, otherwise undefined (empty or foreign-script wording). */
export const safeText = (text?: string): string | undefined => (text && !hasCyrillic(text) ? text : undefined);

/**
 * The few product fields a home tile needs. The page hands these to the client sections instead of whole products, so the
 * long descriptions, specs and galleries do not travel in the page payload. `price` / `originalPrice` stay EUR (the
 * figures the server validates): lei come from ronOf() / ronOriginalOf().
 */
export type RoTileProduct = Pick<Product, "id" | "slug" | "name" | "category" | "price" | "originalPrice" | "badge" | "inStock" | "shortDescription" | "coverImage">;

export const toRoTile = (p: Product): RoTileProduct => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  category: p.category,
  price: p.price,
  originalPrice: p.originalPrice,
  badge: p.badge,
  inStock: p.inStock,
  shortDescription: p.shortDescription,
  coverImage: p.coverImage,
});
