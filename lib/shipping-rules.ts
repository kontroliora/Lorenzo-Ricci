// Bulgaria: the delivery price rule, ONE place for the checkout (display) and /api/order (the server recomputes it and refuses any other number).
// The rule is the same for cash on delivery and for card: free from EUR 60 on the goods (after set discounts, BEFORE any promo code or card discount,
// so a discount never adds delivery), else EUR 4.25 to an Econt office / automat and EUR 5.45 to an address. Pure: no React, no server imports.
// (Romania: lib/ro/pricing.ts roShippingCost, free from 315 lei, else 46 lei.)
export const BG_FREE_SHIPPING_EUR = 60;
export const BG_SHIPPING_OFFICE_EUR = 4.25;
export const BG_SHIPPING_HOME_EUR = 5.45;

/** `courier` is the checkout's value: "econt" = office / automat, "home" = address. */
export const bgShippingCost = (goodsBeforePromo: number, courier: unknown): number =>
  goodsBeforePromo >= BG_FREE_SHIPPING_EUR ? 0 : courier === "home" ? BG_SHIPPING_HOME_EUR : BG_SHIPPING_OFFICE_EUR;
