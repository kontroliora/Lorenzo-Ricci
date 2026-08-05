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
// Geo prices hide the strike-through: originalPrice is EUR and would mislead.

type PriceInput = Pick<Product, "price" | "originalPrice" | "currency" | "priceAED" | "priceRON">;

export type PriceDisplay = {
  text: string;               // formatted current price, e.g. "AED 4,500" / "1.200 lei" / "€175.00"
  original: string | null;    // formatted strike-through, or null (geo price / no discount)
  discountPct: number | null; // for the "-X%" badge, or null (geo price / no discount)
  isGeoPrice: boolean;        // true when showing a manually-set local price instead of EUR
};

const geoPrice = (text: string): PriceDisplay => ({ text, original: null, discountPct: null, isGeoPrice: true });

export function displayPrice(p: PriceInput, country?: string | null): PriceDisplay {
  if (country === "AE" && typeof p.priceAED === "number") {
    return geoPrice(`AED ${Math.round(p.priceAED).toLocaleString("en-US")}`); // 4500 → "AED 4,500"
  }
  if (country === "RO" && typeof p.priceRON === "number") {
    return geoPrice(`${Math.round(p.priceRON).toLocaleString("ro-RO")} lei`); // 1200 → "1.200 lei"
  }

  const cur = p.currency || "€";
  const showOriginal = typeof p.originalPrice === "number" && p.originalPrice > p.price;
  return {
    text:        `${cur}${p.price.toFixed(2)}`,
    original:    showOriginal ? `${cur}${p.originalPrice!.toFixed(2)}` : null,
    discountPct: showOriginal ? Math.round((1 - p.price / p.originalPrice!) * 100) : null,
    isGeoPrice:  false,
  };
}
