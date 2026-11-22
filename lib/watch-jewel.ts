// "Допълнете визията" (owner, 22.11.2026): a cart with a watch gets men's jewellery at a lower price. ONE place for the rule.
// Pure (no React, no catalog import), so the cart, the checkout, /api/order (lib/order-pricing.ts) and the panel read the same thing.
//
//   - While the cart holds at least one watch, ONE unit of each piece below costs WATCH_JEWEL.price (€19) instead of its catalog
//     price (€24). More units of the same piece, or no watch: the catalog price.
//   - It is a discount line of the set-discount engine (lib/bundles.ts calcBundleDiscount, id WATCH_JEWEL.lineId), never a price
//     change on the line: the line keeps its catalog price, so the server's price guard, Stripe's coupon, the card -5%, free
//     delivery and abandoned-cart recovery all re-derive it from the lines. Remove the watch and the discount is simply gone.
//   - Stock is the usual all-or-nothing reservation of /api/order (the piece is a normal paid line).

import type { CartItem } from "./types";

export const WATCH_JEWEL = {
  enabled: true,
  price: 19,
  lineId: "watch-jewel",
  label: "Бижу към часовник",
  /** Suggestion order in the cart block; only these get the price. */
  slugs: ["bracelet-milano-twist", "bracelet-signature", "necklace-milano-twist", "necklace-grande-imperiale"],
} as const;

const ELIGIBLE: ReadonlySet<string> = new Set(WATCH_JEWEL.slugs);
export const isWatchJewel = (slug: string): boolean => ELIGIBLE.has(slug);

type Line = Pick<CartItem, "product" | "quantity">;

export const cartHasWatch = (items: readonly Line[]): boolean =>
  items.some((i) => i.product.category === "watches" && i.quantity > 0);

/** Discount per cart line (by slug): one unit of each eligible piece at WATCH_JEWEL.price while a watch is in the cart. */
export function watchJewelDiscounts(items: readonly Line[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!WATCH_JEWEL.enabled || !cartHasWatch(items)) return out;
  for (const i of items) {
    const slug = i.product.slug;
    if (!isWatchJewel(slug) || i.quantity < 1 || out.has(slug)) continue;
    const d = Math.round(Math.max(0, i.product.price - WATCH_JEWEL.price) * 100) / 100;
    if (d > 0) out.set(slug, d);
  }
  return out;
}

export const watchJewelTotal = (items: readonly Line[]): number =>
  Math.round([...watchJewelDiscounts(items).values()].reduce((s, d) => s + d, 0) * 100) / 100;
