import type { Product } from "@/lib/types";
import type { RoCartLine } from "@/lib/ro/store";
import { ronOf, ronOriginalOf, roNeedsPrepayment } from "@/lib/ro/config";

/**
 * The Romanian cart line for a product (price in lei; sale snapshot; prepayment flag), shared by the add-to-cart button and the
 * set offer so both fill the cart identically. `product` is the localized, override-applied product the page shows.
 * originalRon is always set (undefined when not on sale) so a re-add overwrites a stale sale snapshot.
 */
export function roCartLine(p: Product, stock?: number): Omit<RoCartLine, "quantity"> {
  const originalRon = ronOriginalOf(p);
  return {
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    ron: ronOf(p),
    originalRon,
    onSale: originalRon !== undefined,
    prepay: roNeedsPrepayment(p),
    image: p.coverImage.src,
    imageAlt: p.coverImage.alt,
    stock,
  };
}
