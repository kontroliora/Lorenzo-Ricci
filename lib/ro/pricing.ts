// Romania market: the ONE place that turns lines into money. Pure (no React, no server imports), so the cart UI,
// the checkout and /api/order-ro compute exactly the same numbers. All amounts are whole-lei numbers (RON).
import { BUNDLES } from "@/lib/bundles";
import { RO_FREE_SHIPPING_RON, RO_SHIPPING_FEE_RON, RO_COD_FEE_RON } from "./config";
import { RO_BUNDLE_LABEL } from "./bundles-ro";
import { cardDiscountRon } from "@/lib/card-discount";

export type PricedLine = { ron: number; quantity: number };
/** A line that can take part in a set: its slug, and whether the product is on sale (a sale item earns no set discount). */
export type BundleLine = PricedLine & { slug: string; onSale?: boolean };

export const roSubtotal = (lines: PricedLine[]): number => lines.reduce((s, l) => s + l.ron * l.quantity, 0);

/**
 * Set ("комплект") discounts, same rules as the Bulgarian cart (lib/bundles.ts calcBundleDiscount) computed on the lei prices and
 * rounded to whole lei: every slot of the set filled, and no sale item among the matched products (no stacking).
 */
export function roBundleDiscount(lines: BundleLine[]): { totalDiscount: number; active: { id: string; label: string; discount: number }[] } {
  const bySlug = new Map(lines.map((l) => [l.slug, l]));
  let totalDiscount = 0;
  const active: { id: string; label: string; discount: number }[] = [];
  for (const b of BUNDLES) {
    const matched = b.slots.map((slot) => {
      const slug = slot.find((id) => bySlug.has(id));
      return slug ? bySlug.get(slug)! : undefined;
    });
    if (matched.some((m) => !m)) continue;                      // a slot is empty
    if (matched.some((m) => m!.onSale)) continue;               // no stacking on sale items
    const base = matched.reduce((s, m) => s + m!.ron * m!.quantity, 0);
    const discount = Math.round((base * b.discountPct) / 100);
    totalDiscount += discount;
    if (discount > 0) active.push({ id: b.id, label: RO_BUNDLE_LABEL[b.id] ?? b.label, discount });
  }
  return { totalDiscount, active };
}

/**
 * Every amount of an order, from its lines. `goods` is after set discounts; delivery is judged on `goods`.
 * A CARD order pays 5% less on the goods (max 130 lei, lib/card-discount.ts) and has free delivery and no ramburs fee:
 * total = goods - cardDiscount. (Romania has no promo codes, so the card discount never meets one.)
 */
export function roAmounts(lines: BundleLine[], opts: { card?: boolean } = {}): { subtotal: number; discount: number; goods: number; cardDiscount: number; shipping: number; total: number; bundles: { id: string; label: string; discount: number }[] } {
  const subtotal = roSubtotal(lines);
  const { totalDiscount, active } = roBundleDiscount(lines);
  const goods = subtotal - totalDiscount;
  const shipping = opts.card ? 0 : roShippingCost(goods);
  const cardDiscount = opts.card ? cardDiscountRon(goods) : 0;
  return { subtotal, discount: totalDiscount, goods, cardDiscount, shipping, total: goods - cardDiscount + shipping + (opts.card ? 0 : RO_COD_FEE_RON), bundles: active };
}

/** Free delivery from the threshold up (amount after set discounts), otherwise the flat fee. */
export const roShippingCost = (subtotal: number): number => (subtotal >= RO_FREE_SHIPPING_RON ? 0 : RO_SHIPPING_FEE_RON);

/** What the courier collects on delivery (ramburs). */
export const roTotal = (subtotal: number): number => subtotal + roShippingCost(subtotal) + RO_COD_FEE_RON;
