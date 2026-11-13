"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "./types";
import { calcBundleDiscount, type BundleResult } from "./bundles";

export interface RecoveryPrefill {
  name?:  string;
  email?: string;
  phone?: string;
}

/** The cart reservation (the drawer's countdown): 15 minutes from the first item. A saved cart older than this is dropped on load. */
export const CART_RESERVATION_MS = 15 * 60 * 1000;

interface CartStore {
  items: CartItem[];
  /** When the current reservation started (first item into an empty cart); null while empty. Saved with the cart. */
  reservedAt: number | null;
  /** Replace the lines after a reload's re-check (catalog, price overrides, live stock); never opens the drawer. */
  replaceItems: (items: CartItem[]) => void;
  isOpen: boolean;
  /** `giftSlug`: the free cardholder chosen for this watch unit (lib/watch-gift.ts). */
  addItem: (product: Product, giftSlug?: string) => void;
  /** The cart reminder: give a watch line's next unit its free cardholder. */
  addLineGift: (productId: string, giftSlug: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
  bundleDiscount: () => BundleResult;

  // Abandoned-cart recovery: repopulate the cart from a saved session and open
  // the drawer straight at the checkout step, with contact fields pre-filled.
  pendingCheckout: boolean;
  recoveryPrefill: RecoveryPrefill | null;
  restoreCart: (items: CartItem[], prefill?: RecoveryPrefill) => void;
  clearPendingCheckout: () => void;
}

// Saved in the browser (owner, 08.11.2026) like the Romanian cart (lib/ro/store.ts): the lines and the reservation start survive a
// reload and a closed tab. skipHydration: components/cart/CartPersistence.tsx restores it after mount, drops it when the
// reservation ran out, and re-checks every line against the catalog, the price overrides and live stock.
export const useCartStore = create<CartStore>()(persist((set, get) => ({
  items: [],
  isOpen: false,
  reservedAt: null,
  replaceItems: (items) => set({ items, reservedAt: items.length ? get().reservedAt ?? Date.now() : null }),

  addItem: (product, giftSlug) => {
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        const maxQty = product.stock ?? Infinity;
        if (existing.quantity >= maxQty) return state;
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1, ...(giftSlug ? { giftSlugs: [...(i.giftSlugs ?? []), giftSlug] } : {}) }
              : i
          ),
          isOpen: true,
        };
      }
      return { items: [...state.items, { product, quantity: 1, ...(giftSlug ? { giftSlugs: [giftSlug] } : {}) }], isOpen: true, reservedAt: state.items.length ? state.reservedAt ?? Date.now() : Date.now() };
    });
  },

  addLineGift: (productId, giftSlug) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId && (i.giftSlugs?.length ?? 0) < i.quantity
          ? { ...i, giftSlugs: [...(i.giftSlugs ?? []), giftSlug] }
          : i
      ),
    }));
  },

  removeItem: (productId) => {
    set((state) => {
      const items = state.items.filter((i) => i.product.id !== productId);
      return { items, reservedAt: items.length ? state.reservedAt : null };
    });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity < 1) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      // one free cardholder per watch: fewer watches = the extra gifts go (the last chosen first)
      items: state.items.map((i) =>
        i.product.id === productId ? { ...i, quantity, ...(i.giftSlugs ? { giftSlugs: i.giftSlugs.slice(0, quantity) } : {}) } : i
      ),
    }));
  },

  clearCart: () => set({ items: [], reservedAt: null, recoveryPrefill: null, pendingCheckout: false }),
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  totalPrice: () =>
    get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
  bundleDiscount: () => calcBundleDiscount(get().items),

  // ── Recovery ────────────────────────────────────────────────────────────────
  pendingCheckout: false,
  recoveryPrefill: null,
  restoreCart: (items, prefill) =>
    set({ items, isOpen: true, pendingCheckout: true, recoveryPrefill: prefill ?? null, reservedAt: Date.now() }),
  clearPendingCheckout: () => set({ pendingCheckout: false }),
}), { name: "lr-cart", partialize: (s) => ({ items: s.items, reservedAt: s.reservedAt }), skipHydration: true }));
