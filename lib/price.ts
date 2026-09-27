import type { Product } from "./types";

// Single source of truth for how a product's price is shown. EVERY render site
// (product page, listing, cart line, sticky bar, homepage) goes through this —
// no scattered currency logic. Pure function: the caller supplies the detected
// country (useCountry() client-side, or resolveCountry() server-side).
//
// Geo prices are MANUALLY SET fields, not live FX conversions — stable, roundable
// to luxury price points, and no external dependency to fail. Revise them
// periodically instead.
//
// Rules, in order:
//   AE + priceAED → "AED 4,500"  (no symbol, no decimals)
//   RO + priceRON → "1.200 lei"  (RO thousands separator, no decimals)
//   everyone else — including a geo with no price set → the EUR base price.

type PriceInput = Pick<Product, "price" | "originalPrice" | "currency" | "priceAED" | "priceRON">;

export type PriceDisplay = {
  text: string;            // formatted current price, e.g. "AED 4,500" / "1.200 lei" / "€279.00"
  original: string | null; // crossed-out prior price during a sale, or null (geo price / not on sale)
  isGeoPrice: boolean;     // true when showing a manually-set local price instead of EUR
};

// A product is ON SALE when it carries an originalPrice above its price. That
// originalPrice is the crossed-out "old" price and MUST be the lowest price the
// product had in the previous 30 days (EU Omnibus rule) — check the git history of
// lib/products.ts before setting one. No stacking: a sale item never gets a set
// (bundle) or promo-code discount on top — lib/bundles.ts, the cart drawer and the
// server check in lib/order-pricing.ts all use this.
export const isOnSale = (p: Pick<Product, "price" | "originalPrice">): boolean =>
  typeof p.originalPrice === "number" && p.originalPrice > p.price;

// Geo prices hide the strike-through: originalPrice is EUR and would mislead.
const geoPrice = (text: string): PriceDisplay => ({ text, original: null, isGeoPrice: true });

// Prepayment threshold: EUR base price only (the geo-display prices are cosmetic,
// never the collected amount) — computed from price, not a per-product flag, so it
// can't drift out of sync if a price changes. Cash-on-delivery is hidden at or above
// this; checkout must direct the customer to arrange payment manually (no card/PSP
// integration exists yet — see CheckoutForm's prepayment block).
export const PREPAYMENT_THRESHOLD_EUR = 1500;
export const requiresPrepayment = (p: Pick<Product, "price">): boolean => p.price >= PREPAYMENT_THRESHOLD_EUR;

export function displayPrice(p: PriceInput, country?: string | null): PriceDisplay {
  if (country === "AE" && typeof p.priceAED === "number") {
    return geoPrice(`AED ${Math.round(p.priceAED).toLocaleString("en-US")}`); // 4500 → "AED 4,500"
  }
  if (country === "RO" && typeof p.priceRON === "number") {
    return geoPrice(`${Math.round(p.priceRON).toLocaleString("ro-RO")} lei`); // 1200 → "1.200 lei"
  }

  const cur = p.currency || "€";
  return {
    text: `${cur}${p.price.toFixed(2)}`,
    original: isOnSale(p) ? `${cur}${p.originalPrice!.toFixed(2)}` : null,
    isGeoPrice: false,
  };
}
