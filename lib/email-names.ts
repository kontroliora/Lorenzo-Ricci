// BG e-mails: a women's-collection line always shows the piece's CURRENT name ("Гривна Verdis Gold", renamed 27-28.11.2026),
// also on carts and orders saved before the rename. Orders and carts store the name they had at the time; the slug is stable.
// Only the collection pieces are looked up here, so the other products and the gift lines keep their stored wording.
import { NEW_COLLECTION_PRODUCTS } from "./new-collection-products";

const NAMES: ReadonlyMap<string, string> = new Map(NEW_COLLECTION_PRODUCTS.map((p) => [p.slug, p.name]));

/** The current BG name of a collection piece, else `stored` unchanged. A stored "ПОДАРЪК: " prefix is kept. */
export function currentNameBg(slug: unknown, stored: string): string {
  const now = typeof slug === "string" ? NAMES.get(slug) : undefined;
  if (!now) return stored;
  return /^ПОДАРЪК:\s*/.test(stored) ? `ПОДАРЪК: ${now}` : now;
}
