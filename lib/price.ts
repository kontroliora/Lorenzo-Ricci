import type { Product } from "./types";

// Single source of truth for how a product's price is shown. EVERY render site
// (product page, listing, cart line, sticky bar, homepage) goes through this —
// no scattered currency logic. Pure function: the caller supplies the detected
// country (useCountry() client-side, or the x-vercel-ip-country header server-side).
//
// Rule: UAE visitor AND the product has a priceAED → AED (no symbol, no decimals,
// grouped thousands, strike-through hidden). Everyone else — including AE when the
// product has no priceAED — → the EUR base price.

type PriceInput = Pick<Product, "price" | "originalPrice" | "currency" | "priceAED">;

export type PriceDisplay = {
  text: string;               // formatted current price, e.g. "AED 4,500" or "€175.00"
  original: string | null;    // formatted strike-through, or null (AED / no discount)
  discountPct: number | null; // for the "-X%" badge, or null (AED / no discount)
  isAED: boolean;
};

const formatAED = (n: number): string => Math.round(n).toLocaleString("en-US"); // 4500 → "4,500"

export function displayPrice(p: PriceInput, country?: string | null): PriceDisplay {
  if (country === "AE" && typeof p.priceAED === "number") {
    return { text: `AED ${formatAED(p.priceAED)}`, original: null, discountPct: null, isAED: true };
  }
  const cur = p.currency || "€";
  const showOriginal = typeof p.originalPrice === "number" && p.originalPrice > p.price;
  return {
    text:        `${cur}${p.price.toFixed(2)}`,
    original:    showOriginal ? `${cur}${p.originalPrice!.toFixed(2)}` : null,
    discountPct: showOriginal ? Math.round((1 - p.price / p.originalPrice!) * 100) : null,
    isAED:       false,
  };
}
