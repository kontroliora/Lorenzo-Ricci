// 301 redirects of the pages of a hidden collection (lib/storefront.ts SHELF): the category pages and every product
// page of a collection that is switched off lead to the women's collection instead of a 404. Read by middleware.ts only.
// Switching a collection back on (SHELF.<group> = true) removes its redirects by itself: nothing to change here.
//
// Not redirected on purpose: /bundles + /ro/seturi (the women's sets stay), /namalenia + /ro/reduceri (show whatever is on sale
// among the pieces on the shelf), the policy / FAQ / story / warranty pages (they stay, with their copy adapted), and the watch
// guide /watch-manual + /ro/ghid-ceas: it is the manual of the people who already own a watch (it is only no longer linked from the
// shop and left out of the sitemap).

import { allProducts } from "./products";
import { SHELF, WOMENS_LANDING, onShelf } from "./storefront";

/** Slugs of every product whose collection is switched off (the pre-launch `hidden` pieces of the women's collection are not here). */
const OFF_SHELF = new Set(allProducts.filter((p) => !onShelf(p)).map((p) => p.slug));

const BG_PAGES = new Set<string>([
  ...(SHELF.watches ? [] : ["/watches"]),
  ...(SHELF.leather ? [] : ["/leather-goods"]),
]);
const RO_PAGES = new Set<string>([
  ...(SHELF.watches ? [] : ["/ro/ceasuri"]),
  ...(SHELF.leather ? [] : ["/ro/piele-de-crocodil"]),
]);

export interface OffShelfTarget { path: string; hash: string }

/**
 * Where a hidden page goes, or null when the path is not one. `roOpen` = the Romanian store is on: a Romanian page then goes to the
 * Romanian women's collection, otherwise (every /ro page is a 302 to its Bulgarian twin anyway) straight to the Bulgarian one.
 */
export function offShelfTarget(pathname: string, roOpen: boolean): OffShelfTarget | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const bg = WOMENS_LANDING.bg, ro = WOMENS_LANDING.ro;
  if (BG_PAGES.has(p)) return { path: bg.path, hash: bg.hash };
  const bgProduct = p.match(/^\/products\/([a-z0-9-]+)$/);
  if (bgProduct && OFF_SHELF.has(bgProduct[1])) return { path: bg.path, hash: bg.hash };
  if (RO_PAGES.has(p)) return roOpen ? { path: ro.path, hash: ro.hash } : { path: bg.path, hash: bg.hash };
  const roProduct = p.match(/^\/ro\/produse\/([a-z0-9-]+)$/);
  if (roProduct && OFF_SHELF.has(roProduct[1])) return roOpen ? { path: ro.path, hash: ro.hash } : { path: bg.path, hash: bg.hash };
  return null;
}
