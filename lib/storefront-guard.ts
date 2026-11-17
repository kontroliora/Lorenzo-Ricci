// Page-level twin of the 301s in middleware.ts (lib/storefront-redirects.ts), for server pages only. The middleware skips Next's own
// in-app navigations (RSC / prefetch requests), so a page of a hidden collection that a visitor's open tab still links to would
// otherwise render its (empty) listing: it redirects here too (permanentRedirect = 308, same meaning for browsers and crawlers).

import { permanentRedirect } from "next/navigation";
import { SHELF, WOMENS_LANDING, onShelf, type ShelfGroup } from "./storefront";
import { getCatalogProductBySlug } from "./products";

const to = (lang: "bg" | "ro"): string => `${WOMENS_LANDING[lang].path}#${WOMENS_LANDING[lang].hash}`;

/** Category / guide page of a collection: goes to the women's collection while that collection is switched off. */
export function redirectIfCollectionOff(group: ShelfGroup, lang: "bg" | "ro" = "bg"): void {
  if (!SHELF[group]) permanentRedirect(to(lang));
}

/** Product page: a known product of a switched-off collection goes to the women's collection (an unknown slug stays a 404). */
export function redirectIfProductOff(slug: string, lang: "bg" | "ro" = "bg"): void {
  const p = getCatalogProductBySlug(slug);
  if (p && !onShelf(p)) permanentRedirect(to(lang));
}
