// What is on the shop window: one flag per collection (women's 2026 pieces: Verdis, Noctis, Lumen, Linea, Solaris, Spira -
// lib/new-collection.ts). A collection that is switched OFF is HIDDEN, never deleted: its products, photos, stock rows,
// orders and every piece of copy stay in the code and in Supabase; only the public shop stops showing / selling it.
//
// TO BRING A COLLECTION BACK: set its flag below to true and deploy. That one change puts it back in the menu, the home page,
// the footer, the listings, the sitemap, the cart and the order checks, and stops the 301s (lib/storefront-redirects.ts) for it.
//
//   womens           the 2026 women's collection (jewellery)                                   - ON
//   jewelleryClassic the older jewellery range (Milano Forte / Twist, Aurelius, Signature ...) - ON (back since 17.11.2026; the
//                    home page called it "Мъжка колекция"; unisex / men's)
//   watches          Yachting, Chrono Black, Golden Eclipse, Polar Frost                       - ON (back since 17.11.2026)
//   leather          wallets, cardholders, clutch bags (crocodile leather)                     - ON (back since 17.11.2026)
//
// How it works: lib/products.ts builds `products` (the shop's catalogue: listings, product pages, sitemap, cart, cross-sells, the
// order APIs) from the pieces that are ON the shelf, and keeps `allProducts` / getCatalogProductBySlug() (everything) for the
// admin panel and for old orders. Orders already placed for a hidden product keep working: e-mails, the tracking page and the panel
// read the order's own saved lines, never the shop catalogue.
//
// Pure and edge-safe (no catalogue import): read by lib/products.ts, middleware.ts and client components alike.

import { isCollectionSlug } from "./new-collection";

export type ShelfGroup = "womens" | "jewelleryClassic" | "watches" | "leather";

export const SHELF: Record<ShelfGroup, boolean> = {
  womens: true,
  jewelleryClassic: true,
  watches: true,
  leather: true,
};

/** Which collection a product belongs to. Women's pieces are told apart by slug (lib/new-collection.ts), the rest by category. */
export function shelfGroup(p: { slug: string; category: string }): ShelfGroup {
  if (isCollectionSlug(p.slug)) return "womens";
  if (p.category === "watches") return "watches";
  if (p.category === "jewellery") return "jewelleryClassic";
  return "leather"; // wallets, cardholders, bags
}

/** The product is on the shop window (its collection is switched on). Says nothing about stock or the pre-launch `hidden` flag. */
export const onShelf = (p: { slug: string; category: string }): boolean => SHELF[shelfGroup(p)];

/** Where a visitor of a hidden page is sent (301): the women's collection, with its anchor on the listing page. */
export const WOMENS_LANDING = { bg: { path: "/jewellery", hash: "damska-kolekcia" }, ro: { path: "/ro/bijuterii", hash: "colectia-pentru-femei" } } as const;
