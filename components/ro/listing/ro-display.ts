// Small display helpers shared by the Romanian cards, listings and set cards. Pure (no React, no server imports), so both
// server pages and client components can use them.
//
// Defence in depth: the Romanian storefront must never print Bulgarian wording. lib/ro/products-ro.ts overlays the
// Romanian text, but a product (or one field of it) may be missing there; these helpers then fall back to something
// safe instead of showing Cyrillic. Cyrillic block U+0400-U+04FF, tested by code point so no Cyrillic literal sits here.
import type { Product } from "@/lib/types";

export const hasCyrillic = (text: string | undefined | null): boolean =>
  !!text && Array.from(text).some((ch) => { const c = ch.charCodeAt(0); return c >= 1024 && c <= 1279; });

const SUBCATEGORY_LABEL: Record<NonNullable<Product["subcategory"]>, string> = {
  bracelet: "Brățară",
  necklace: "Colier",
};

/**
 * The product name as the Romanian pages show it. The catalogue names are Latin ("Chrono Black", Lorenzo Ricci
 * "Alabastro") except the jewellery ones, which start with a Bulgarian type word before the Latin model name: for those the
 * model name is kept and the Romanian type word is put in front ("Brățară Milano Twist", "Colier Aurelius Cross").
 */
export function roDisplayName(p: Pick<Product, "name" | "subcategory">): string {
  if (!hasCyrillic(p.name)) return p.name;
  const model = p.name.split(/\s+/).filter((w) => w && !hasCyrillic(w)).join(" ");
  const type = p.subcategory ? SUBCATEGORY_LABEL[p.subcategory] : "";
  return [type, model].filter(Boolean).join(" ");
}

/** Text that is safe to print on a Romanian page: the fallback replaces anything containing Cyrillic. */
export const roSafeText = (text: string | undefined, fallback: string): string =>
  text && !hasCyrillic(text) ? text : fallback;
