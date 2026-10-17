// Paying by card earns 5% off the goods, at most €25 (Romania: 130 lei) per order. ONE place for the rule: the checkout shows it, the servers
// (/api/order, /api/order-ro) recompute it and refuse any other number. Pure: no React, no server imports.
//   - base = the goods after the set ("комплект") discounts, before delivery (card orders ship free anyway);
//   - never together with a promo code: an order that carries a promo discount gets no card discount;
//   - EUR in cents (2 decimals), lei in whole lei (like every lei amount of the Romanian shop).
export const CARD_DISCOUNT_PCT = 5;
export const CARD_DISCOUNT_CAP_EUR = 25;
export const CARD_DISCOUNT_CAP_RON = 130;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function cardDiscountEur(goods: number, promoDiscount = 0): number {
  if (!Number.isFinite(goods) || goods <= 0 || promoDiscount > 0) return 0;
  return Math.min(round2((goods * CARD_DISCOUNT_PCT) / 100), CARD_DISCOUNT_CAP_EUR);
}

export function cardDiscountRon(goods: number, promoDiscount = 0): number {
  if (!Number.isFinite(goods) || goods <= 0 || promoDiscount > 0) return 0;
  return Math.min(Math.round((goods * CARD_DISCOUNT_PCT) / 100), CARD_DISCOUNT_CAP_RON);
}

/** True when the 5% was cut down to the cap (the checkout then says "maximum €25"). */
export const cardDiscountIsCapped = (goods: number, currency: "EUR" | "RON"): boolean =>
  currency === "EUR" ? (goods * CARD_DISCOUNT_PCT) / 100 > CARD_DISCOUNT_CAP_EUR : (goods * CARD_DISCOUNT_PCT) / 100 > CARD_DISCOUNT_CAP_RON;
