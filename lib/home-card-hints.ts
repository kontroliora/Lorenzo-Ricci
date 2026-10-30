// Two small hints on the HOMEPAGE product cards only (BG and RO): what a discounted product saves, and a low-stock line.
// Pure helpers, no React. The listings and product pages do not use them.
import { ronOf, ronOriginalOf } from "@/lib/ro/config";

/** The "Остават N бр." / "Au mai rămas N buc." line shows from this many available units downwards (and above 0). */
export const HOME_LOW_STOCK_MAX = 10;

/** Live available units when they are low enough to mention, else null (unknown, 0 = sold out and above the limit show nothing). */
export const lowStockCount = (live: number | null | undefined): number | null =>
  typeof live === "number" && live > 0 && live <= HOME_LOW_STOCK_MAX ? Math.floor(live) : null;

/** Whole euros saved while the product is on sale (struck price - current price), else null. */
export const savingsEur = (p: { price: number; originalPrice?: number }): number | null =>
  typeof p.originalPrice === "number" && p.originalPrice > p.price && Math.round(p.originalPrice - p.price) > 0
    ? Math.round(p.originalPrice - p.price)
    : null;

/** Whole lei saved while the product is on sale (the struck and the current price are both converted to lei first, like the card shows them), else null. */
export const savingsRon = (p: { price: number; originalPrice?: number }): number | null => {
  const old = ronOriginalOf(p);
  return old === undefined ? null : old - ronOf(p);
};
