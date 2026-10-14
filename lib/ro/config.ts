import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import type { ProductCategory } from "@/lib/types";

// Romania market test (watches + crocodile leather goods only). ONE place for the market's facts, so the
// pages, the checkout and the e-mails can't drift apart. Values marked PROVISIONAL are assumptions until the
// courier is chosen (see "Lorenzo Ricci private/romania-test/curieri-si-ramburs.md") - change them here only.

export const RO_BASE_PATH = "/ro";

// Owner's rate: 1 EUR = 5.25 RON. Prices are rounded to whole lei (display and charge), see ronPrice().
export const EUR_RON = 5.25;

// Categories sold in Romania. Jewellery is NOT shown there.
export const RO_CATEGORIES = ["watches", "wallets", "cardholders", "bags"] as const;

// Cash on delivery ("ramburs") is only for goods under this EUR price, same rule as Bulgaria (lib/price.ts
// PREPAYMENT_THRESHOLD_EUR = 1500). Bag "Milano Avorio" (EUR 4000) is therefore not orderable in the RO COD checkout.

// PROVISIONAL - set once the courier and its price list are confirmed:
export const RO_FREE_SHIPPING_EUR = 60;                                 // same threshold as Bulgaria
export const RO_FREE_SHIPPING_RON = Math.round(RO_FREE_SHIPPING_EUR * EUR_RON); // 315
export const RO_SHIPPING_FEE_RON = 25;                                  // PROVISIONAL flat fee under the threshold
export const RO_DELIVERY_DAYS = "2-4";                                  // PROVISIONAL working days after dispatch
export const RO_COURIER_LABEL = "curier rapid";                         // generic until the courier is chosen
export const RO_COD_FEE_RON = 0;                                        // PROVISIONAL: extra ramburs fee charged to the customer

// PROVISIONAL: may the customer open and check the parcel before paying the courier? In Bulgaria Econt allows it
// ("преглед и тест"). Do NOT promise it in Romania until the chosen courier confirms it in writing; copy shows the
// "inspect before paying" promise only when this is true.
export const RO_INSPECT_BEFORE_PAY = false;
export const RO_RETURN_DAYS = 14;                                       // legal right of withdrawal (EU)

export const RO_CURRENCY = "RON";

// Pure helpers live here (not in catalog.ts): client components import this file, and catalog.ts pulls in the whole
// Bulgarian catalog plus the Romanian text overlay.

/** Sold in Romania: watches and crocodile leather goods; never jewellery; never an item that needs prepayment (>= EUR 1500, no COD). */
export const roEligible = (p: { category: string; price: number }): boolean =>
  (RO_CATEGORIES as readonly string[]).includes(p.category) && p.price < PREPAYMENT_THRESHOLD_EUR;

/** Whole lei for a product whose EUR price may already carry a price override (applyOverride). */
export const ronOf = (p: { price: number }): number => ronPrice(p.price);

export const RO_CATEGORY_LABEL: Record<ProductCategory, string> = {
  watches: "Ceasuri",
  wallets: "Portofele",
  cardholders: "Port-carduri",
  bags: "Clutch-uri",
  jewellery: "Bijuterii", // never shown in Romania; kept so the record is complete
};

/** EUR base price -> whole lei (the displayed AND collected amount for the Romania test). */
export function ronPrice(eur: number): number { return Math.round(eur * EUR_RON); }

export const fmtRON = (ron: number): string =>
  `${ron.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei`;
