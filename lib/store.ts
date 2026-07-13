"use client";
import { create } from "zustand";
import type { CartItem, Product } from "./types";
import { calcBundleDiscount, type BundleResult } from "./bundles";

export interface RecoveryPrefill {
  name?:  string;
  email?: string;
  phone?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product) => void;
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

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,

  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        const maxQty = product.stock ?? Infinity;
        if (existing.quantity >= maxQty) return state;
        return {
          items: state.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
          isOpen: true,
        };
      }
      return { items: [...state.items, { product, quantity: 1 }], isOpen: true };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity < 1) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ items: [], recoveryPrefill: null, pendingCheckout: false }),
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
    set({ items, isOpen: true, pendingCheckout: true, recoveryPrefill: prefill ?? null }),
  clearPendingCheckout: () => set({ pendingCheckout: false }),
}));
