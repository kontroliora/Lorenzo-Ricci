"use client";
import { useEffect } from "react";
import { useCartStore, CART_RESERVATION_MS } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import { opoFixesPrice } from "@/lib/one-plus-one";
import type { CartItem } from "@/lib/types";
import { isWatchGiftChoice, watchGiftActive } from "@/lib/watch-gift";

// Restores the Bulgarian cart saved in the browser (lib/store.ts, "lr-cart") once after mount (owner, 08.11.2026):
//   1. a saved cart whose reservation ran out (15 min from the first item, the drawer's countdown) is dropped;
//   2. every line is rebuilt from the catalog (a line saved with an old price or old data never survives a reload), with the
//      current price overrides applied exactly like the rest of the client (lib/use-price-overrides.ts);
//   3. live stock (/api/leather-stock): a sold-out or unknown product is dropped, a quantity above the stock is capped.
// The 1+1 and set discounts are never saved: they are always recomputed from the lines. The order routes check it all again.
async function revalidate(): Promise<void> {
  const { items, reservedAt } = useCartStore.getState();
  if (items.length === 0) return;
  if (reservedAt !== null && Date.now() - reservedAt > CART_RESERVATION_MS) {
    useCartStore.getState().clearCart();
    return;
  }
  const [overrides, stock] = await Promise.all([
    fetch("/api/price-overrides", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, { price: number; originalPrice: number }>>,
    fetch("/api/leather-stock").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<Record<string, number> | null>,
  ]);
  // The cart may have changed while the checks ran (the customer added something): re-check what is there now.
  const now = useCartStore.getState().items;
  // The watches' free cardholders (lib/watch-gift.ts): kept while the offer runs, one per unit at most; dropped after it ends.
  const giftsOf = (g: unknown, q: number) => {
    if (!watchGiftActive() || !Array.isArray(g)) return {};
    const giftSlugs = g.filter(isWatchGiftChoice).slice(0, q);
    return giftSlugs.length ? { giftSlugs } : {};
  };
  const next: CartItem[] = now.flatMap(({ product: saved, quantity, giftSlugs }) => {
    const base = getProductBySlug(saved.slug);
    if (!base || !base.inStock) return [];
    const ov = overrides?.[base.slug];
    const product = ov && !opoFixesPrice(base.slug) ? { ...base, price: ov.price, originalPrice: ov.originalPrice } : base;
    const live = stock?.[base.slug];
    if (typeof live === "number") {
      if (live <= 0) return [];
      return [{ product: { ...product, stock: live }, quantity: Math.min(quantity, live), ...giftsOf(giftSlugs, Math.min(quantity, live)) }];
    }
    return [{ product: { ...product, stock: saved.stock ?? product.stock }, quantity, ...giftsOf(giftSlugs, quantity) }];
  });
  useCartStore.getState().replaceItems(next);
}

export function CartPersistence() {
  useEffect(() => {
    void Promise.resolve(useCartStore.persist.rehydrate()).then(revalidate);
  }, []);
  return null;
}
