// Small hints on the product cards (BG and RO): what a discounted product saves (homepage cards only) and a low-stock line
// (every card: homepage and listings). The product page has its own, looser stock threshold (PAGE_LOW_STOCK_MAX).
// Pure helpers, no React.
import { ronOf, ronOriginalOf } from "@/lib/ro/config";

/** Cards: the "Остават N бр." / "Au mai rămas N buc." line shows from this many available units downwards (and above 0). */
export const CARD_LOW_STOCK_MAX = 3;
/** Product page: the "Остават само N броя" / "Au mai rămas doar N bucăți" line shows from this many available units downwards. */
export const PAGE_LOW_STOCK_MAX = 5;

/** Cards: live available units when they are low enough to mention, else null (unknown, 0 = sold out and above the limit show nothing). */
export const lowStockCount = (live: number | null | undefined): number | null =>
  typeof live === "number" && live > 0 && live <= CARD_LOW_STOCK_MAX ? Math.floor(live) : null;

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
