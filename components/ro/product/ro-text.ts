import type { Product } from "@/lib/types";

// Romanian product page: text guards. Pure (no React, no server imports) so the page and the client components share it.
//
// The Bulgarian catalogue (lib/products.ts) is the source of truth, lib/ro/products-ro.ts overlays the Romanian wording.
// While an overlay entry is missing (the jewellery texts are being added) the product still carries Bulgarian
// wording: the Romanian storefront must never print it. roSafeProduct() drops every text field that still
// contains Cyrillic, so a missing overlay shows less text, never foreign text. Tested by code point range (U+0400-U+04FF),
// so no Cyrillic literal sits in this file.

export function hasCyrillic(s: string | undefined | null): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

// "Brățară" / "Colier": the catalogue names of the jewellery start with a Bulgarian noun ("bracelet" / "necklace") followed by
// the Latin model name; the model name is kept, the noun is replaced by its Romanian equivalent (by subcategory).
const NAME_NOUN: Record<NonNullable<Product["subcategory"]>, string> = { bracelet: "Brățară", necklace: "Colier" };

/**
 * The product name as the Romanian pages show it. Names are not part of the text overlay (lib/ro/products-ro.ts), so a
 * catalogue name that carries Cyrillic ("<bg noun> Diamante Cross") becomes "<ro noun> Diamante Cross"; every other name is
 * returned unchanged.
 */
export function roProductName(p: Pick<Product, "name" | "subcategory">): string {
  if (!hasCyrillic(p.name)) return p.name;
  const model = p.name.split(/\s+/).filter((w) => w && !hasCyrillic(w)).join(" ");
  if (!model) return p.name;
  const noun = p.subcategory ? NAME_NOUN[p.subcategory] : undefined;
  return noun ? `${noun} ${model}` : model;
}

/** True while the product still carries Bulgarian wording in its main texts (its Romanian overlay is missing or partial). */
export function roMissingText(p: Product): boolean {
  const bodies = (p.descriptionSections ?? []).flatMap((s) => [s.heading, ...(Array.isArray(s.body) ? s.body : [s.body])]);
  return [p.description, p.shortDescription, p.warranty, ...p.features, ...p.specs.map((s) => `${s.label} ${s.value}`), ...bodies, ...(p.tabDescription ?? [])]
    .some(hasCyrillic);
}

const clean = (s: string): string => (hasCyrillic(s) ? "" : s);

/**
 * The product with every field that still carries Bulgarian wording removed (and the name/alt texts made Romanian).
 * Apply AFTER localizeProduct(): a fully translated product passes through unchanged.
 */
export function roSafeProduct(p: Product): Product {
  const name = roProductName(p);
  const alt = (a: string): string => (hasCyrillic(a) ? name : a);
  const sections = p.descriptionSections?.filter(
    (s) => !hasCyrillic(s.heading) && !(Array.isArray(s.body) ? s.body : [s.body]).some((b) => hasCyrillic(b)),
  );
  const tab = p.tabDescription?.filter((t) => !hasCyrillic(t));
  const out: Product = {
    ...p,
    name,
    shortDescription: clean(p.shortDescription),
    description: clean(p.description),
    tabDescription: tab && tab.length > 0 ? tab : undefined,
    descriptionSections: sections && sections.length > 0 ? sections : undefined,
    materialNote: p.materialNote && !hasCyrillic(p.materialNote) ? p.materialNote : undefined,
    crocodileSpecies: p.crocodileSpecies && !hasCyrillic(p.crocodileSpecies) ? p.crocodileSpecies : undefined,
    features: p.features.filter((f) => !hasCyrillic(f)),
    specs: p.specs.filter((s) => !hasCyrillic(s.label) && !hasCyrillic(s.value)),
    badge: p.badge && !hasCyrillic(p.badge) ? p.badge : undefined,
    warranty: clean(p.warranty),
    commercial_warranty_text: p.commercial_warranty_text && !hasCyrillic(p.commercial_warranty_text) ? p.commercial_warranty_text : undefined,
    coverImage: { ...p.coverImage, alt: alt(p.coverImage.alt) },
    images: p.images.map((i) => ({ ...i, alt: alt(i.alt) })),
  };
  if (p.descriptionImage) out.descriptionImage = { ...p.descriptionImage, alt: alt(p.descriptionImage.alt) };
  if (p.descriptionImages) out.descriptionImages = p.descriptionImages.map((i) => ({ ...i, alt: alt(i.alt) }));
  return out;
}

/**
 * "1 recenzie", "12 recenzii", "435 de recenzii": Romanian takes "de" after a number of 20 and up (and after round hundreds),
 * i.e. when its last two digits are 00 or 20-99.
 */
export function roReviewsCount(n: number): string {
  if (n === 1) return "1 recenzie";
  const last2 = n % 100;
  return last2 === 0 || last2 >= 20 ? `${n} de recenzii` : `${n} recenzii`;
}

/** 4.77 -> "4,8" */
export const roRatingText = (avg: number): string => avg.toFixed(1).replace(".", ",");
