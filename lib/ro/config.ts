import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import type { ProductCategory } from "@/lib/types";

// Romania market (the whole catalogue: watches, jewellery, crocodile leather goods, sets). ONE place for the market's facts, so the
// pages, the checkout and the e-mails can't drift apart. Values marked PROVISIONAL are assumptions until the
// courier is chosen (see "Lorenzo Ricci private/romania-test/curieri-si-ramburs.md") - change them here only.

export const RO_BASE_PATH = "/ro";

// Owner's rate: 1 EUR = 5.25 RON. Prices are rounded to whole lei (display and charge), see ronPrice().
export const EUR_RON = 5.25;

// Romanians see the whole catalogue (owner, 2026-10-14). Cash on delivery ("ramburs") is only for goods under EUR 1500,
// same rule as Bulgaria (lib/price.ts PREPAYMENT_THRESHOLD_EUR): the bag "Milano Avorio" (EUR 4000) is shown and sold on
// prepayment, arranged directly with the shop, exactly like on the Bulgarian site.

// DELIVERY TERMS - confirmed by the owner on 2026-10-14: free from 315 lei (EUR 60 x 5.25), 46 lei below it, 2-4 working days.
export const RO_FREE_SHIPPING_EUR = 60;                                 // same threshold as Bulgaria
export const RO_FREE_SHIPPING_RON = Math.round(RO_FREE_SHIPPING_EUR * EUR_RON); // 315
export const RO_SHIPPING_FEE_RON = 46;                                  // flat delivery fee under the threshold
export const RO_DELIVERY_DAYS = "2-4";                                  // working days after dispatch
// The two delivery choices at checkout. The strings are the contract with /api/order-ro and are saved as orders.shipping_method;
// the office choice has the same price as delivery to the address (free from 315 lei, else 46 lei) and a hand-typed office address.
export const RO_SHIPPING_HOME = "Livrare la domiciliu";
export const RO_SHIPPING_OFFICE = "Livrare la locker sau biroul Speedy";
/** The same choice as the Romanian shop saved it while the courier was still Econt: such orders (and a stale checkout tab) still count as "office". */
export const RO_SHIPPING_OFFICE_LEGACY = "Livrare la biroul Econt";
export const isRoOfficeMethod = (m: unknown): boolean => m === RO_SHIPPING_OFFICE || m === RO_SHIPPING_OFFICE_LEGACY;
export const RO_COURIER_LABEL = "Speedy";                                   // the courier of the Romanian shop (owner, 17.10.2026)
export const RO_COD_FEE_RON = 0;                                        // PROVISIONAL: extra ramburs fee charged to the customer

// PROVISIONAL: may the customer open and check the parcel before paying the courier? In Bulgaria Econt allows it (the Romanian courier is Speedy: ask Speedy)
// ("преглед и тест"). Do NOT promise it in Romania until the chosen courier confirms it in writing; copy shows the
// "inspect before paying" promise only when this is true.
export const RO_INSPECT_BEFORE_PAY = false;
export const RO_RETURN_DAYS = 14;                                       // legal right of withdrawal (EU)

export const RO_CURRENCY = "RON";

// Pure helpers live here (not in catalog.ts): client components import this file, and catalog.ts pulls in the whole
// Bulgarian catalog plus the Romanian text overlay.

/** Every catalogue product is sold in Romania (kept as a function so callers do not change). */
export const roEligible = (_p?: { category: string; price: number }): boolean => true; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Needs prepayment (EUR 1500 and up): no cash on delivery, the customer arranges payment with the shop. */
export const roNeedsPrepayment = (p: { price: number }): boolean => p.price >= PREPAYMENT_THRESHOLD_EUR;

/** Whole lei for a product whose EUR price may already carry a price override (applyOverride). */
export const ronOf = (p: { price: number }): number => ronPrice(p.price);

/**
 * The crossed-out price in lei while the product is on sale in Bulgaria (originalPrice above price): the same sale, the
 * same old price, converted and rounded to whole lei. undefined when not on sale (or when rounding made them equal).
 */
export const ronOriginalOf = (p: { price: number; originalPrice?: number }): number | undefined =>
  typeof p.originalPrice === "number" && p.originalPrice > p.price && ronPrice(p.originalPrice) > ronPrice(p.price)
    ? ronPrice(p.originalPrice)
    : undefined;

export const RO_CATEGORY_LABEL: Record<ProductCategory, string> = {
  watches: "Ceasuri",
  wallets: "Portofele",
  cardholders: "Port-carduri",
  bags: "Genți",
  jewellery: "Bijuterii",
};

/** EUR base price -> whole lei (the displayed AND collected amount for the Romania test). */
export function ronPrice(eur: number): number { return Math.round(eur * EUR_RON); }

export const fmtRON = (ron: number): string =>
  `${ron.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei`;
