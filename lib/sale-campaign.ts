import type { Product } from "./types";
import { isOnSale } from "./price";

// Homepage sale banner + /namalenia (owner, 26.10.2026). Pure: no React, no server imports.
//
// CAMPAIGN PHASES - the ONE place to edit the label. Dates are day-month, inclusive, Europe/Sofia, every year.
// Outside every phase the banner is hidden (the /namalenia page still lists the discounted products).
export const CAMPAIGN_PHASES: { from: string; to: string; label: string }[] = [
  { from: "23.10", to: "31.10", label: "Есенно намаление" },
  { from: "01.11", to: "14.11", label: "Ранен Черен петък" },
  { from: "15.11", to: "26.11", label: "Черен петък" },
  { from: "27.11", to: "30.11", label: "Черен петък · финал" },
  { from: "01.12", to: "15.12", label: "Коледно намаление" },
  { from: "16.12", to: "31.12", label: "Финална разпродажба" },
];

/** "26.10" for the given moment, in Bulgarian time. */
function sofiaDayMonth(now: Date): { d: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit" }).formatToParts(now);
  return { d: Number(parts.find((p) => p.type === "day")?.value), m: Number(parts.find((p) => p.type === "month")?.value) };
}
const key = (dm: string): number => { const [d, m] = dm.split(".").map(Number); return m * 100 + d; };

/** The label of the campaign phase running at `now` (Europe/Sofia), or null outside every phase. */
export function campaignLabel(now: Date = new Date()): string | null {
  const { d, m } = sofiaDayMonth(now);
  const today = m * 100 + d;
  return CAMPAIGN_PHASES.find((p) => today >= key(p.from) && today <= key(p.to))?.label ?? null;
}

/** Discount of one product in % of its regular (crossed-out) price; 0 when it is not on sale. */
export const discountPct = (p: Pick<Product, "price" | "originalPrice">): number =>
  isOnSale(p) ? ((p.originalPrice! - p.price) / p.originalPrice!) * 100 : 0;

/** Products on sale that can be bought now (in stock and not switched off), biggest discount first. */
export function discountedProducts<T extends Product>(products: T[], soldOut: ReadonlySet<string>): T[] {
  return products
    .filter((p) => p.inStock && !soldOut.has(p.slug) && isOnSale(p))
    .sort((a, b) => discountPct(b) - discountPct(a) || a.price - b.price);
}

/** The banner's "до −N%": the biggest discount among buyable sale products, rounded DOWN to 5% (53 -> 50). 0 = no banner. */
export function maxDiscountRounded(products: Product[], soldOut: ReadonlySet<string>): number {
  const top = discountedProducts(products, soldOut)[0];
  return top ? Math.floor(discountPct(top) / 5 + 1e-9) * 5 : 0;
}
