// Romania market: the ONE place that turns lines into money. Pure (no React, no server imports), so the cart UI,
// the checkout and /api/order-ro compute exactly the same numbers. All amounts are whole-lei numbers (RON).
import { RO_FREE_SHIPPING_RON, RO_SHIPPING_FEE_RON, RO_COD_FEE_RON } from "./config";

export type PricedLine = { ron: number; quantity: number };

export const roSubtotal = (lines: PricedLine[]): number => lines.reduce((s, l) => s + l.ron * l.quantity, 0);

/** Free delivery from the threshold up, otherwise the flat fee (both provisional until the courier is chosen). */
export const roShippingCost = (subtotal: number): number => (subtotal >= RO_FREE_SHIPPING_RON ? 0 : RO_SHIPPING_FEE_RON);

/** What the courier collects on delivery (ramburs). */
export const roTotal = (subtotal: number): number => subtotal + roShippingCost(subtotal) + RO_COD_FEE_RON;
