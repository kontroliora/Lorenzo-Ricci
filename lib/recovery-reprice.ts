import type { CartItem, Product } from "./types";
import { calcBundleDiscount } from "./bundles";
import { ronOf, ronOriginalOf } from "./ro/config";
import { roName } from "./ro/names-ro";
import { roAmounts } from "./ro/pricing";
import type { RecoveryCartItem } from "./recovery-email";
import type { RoRecoveryItem } from "./ro/recovery-email";

// Abandoned-cart reminders: a cart_sessions row stores the lines and the subtotal as they were when the cart was saved, so a
// reminder built from them shows yesterday's prices after a price change. The restore link already rebuilds the cart from the
// live catalogue (app/vazstanovi, app/ro/restabilire); these do the same for the e-mail, so the e-mail and the restored cart agree.
//   - every line is looked up by slug in the live catalogue (the caller passes findProduct with the price overrides applied);
//   - a product that no longer exists or is switched off (inStock: false) is dropped - it could not be ordered anyway;
//   - the total is the goods after the set discounts, the same figure the checkout saves as `subtotal` (no promo code: the
//     restore link does not bring one back).
// Pure: no server imports. null = nothing left to remind about.

type SavedLine = { slug?: unknown; quantity?: unknown; qty?: unknown };

function liveLines(saved: unknown, findProduct: (slug: string) => Product | undefined): CartItem[] {
  if (!Array.isArray(saved)) return [];
  const lines: CartItem[] = [];
  for (const raw of saved as SavedLine[]) {
    const product = typeof raw?.slug === "string" ? findProduct(raw.slug) : undefined;
    if (!product || !product.inStock) continue;
    const q = Math.floor(Number(raw.quantity ?? raw.qty ?? 1));
    const quantity = Number.isFinite(q) && q >= 1 ? q : 1;
    const same = lines.find((l) => l.product.slug === product.slug);
    if (same) same.quantity += quantity;
    else lines.push({ product, quantity });
  }
  return lines;
}

/** Bulgarian reminder: EUR lines at today's prices and the goods total after set discounts. */
export function repriceBgRecovery(
  saved: unknown,
  findProduct: (slug: string) => Product | undefined,
): { items: RecoveryCartItem[]; subtotal: number } | null {
  const lines = liveLines(saved, findProduct);
  if (lines.length === 0) return null;
  const gross = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const subtotal = Math.round((gross - calcBundleDiscount(lines).totalDiscount) * 100) / 100;
  const items = lines.map(({ product: p, quantity }) => ({
    name: p.name, sku: p.sku, slug: p.slug, price: p.price, currency: p.currency || "€", quantity, coverImage: p.coverImage,
  }));
  return { items, subtotal };
}

/** Romanian reminder: whole-lei lines at today's prices (EUR x 5.25) and the goods total from lib/ro/pricing.ts. */
export function repriceRoRecovery(
  saved: unknown,
  findProduct: (slug: string) => Product | undefined,
): { items: RoRecoveryItem[]; subtotal: number } | null {
  const lines = liveLines(saved, findProduct);
  if (lines.length === 0) return null;
  const priced = lines.map(({ product: p, quantity }) => ({ slug: p.slug, ron: ronOf(p), quantity, onSale: ronOriginalOf(p) !== undefined })); // as /api/order-ro
  const items = lines.map(({ product: p, quantity }) => ({ name: roName(p), sku: p.sku, slug: p.slug, price: ronOf(p), quantity }));
  return { items, subtotal: roAmounts(priced).goods };
}
