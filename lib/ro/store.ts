"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Romania market cart: SEPARATE from the Bulgarian cart (lib/store.ts) so the two storefronts can never mix lines,
// currencies or drawers. Lines are snapshots (name, price in lei, image) taken from the page that added them; the
// server (/api/order-ro) never trusts those prices, it recomputes them from the catalog.
export type RoCartLine = {
  slug: string;
  sku: string;
  name: string;
  ron: number;          // unit price, whole lei
  originalRon?: number; // crossed-out price in lei while the product is on sale
  onSale?: boolean;     // on sale: earns no set discount
  prepay?: boolean;     // EUR 1500 and up: no cash on delivery (arranged with the shop)
  image: string;        // cover image src
  imageAlt: string;
  quantity: number;
  stock?: number;       // live stock cap when known
};

interface RoCartStore {
  items: RoCartLine[];
  isOpen: boolean;
  addItem: (line: Omit<RoCartLine, "quantity">) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clear: () => void;
  /** Rewrite or drop every line (null = drop). Used to refresh stale price snapshots from the catalog. */
  reprice: (fn: (line: RoCartLine) => RoCartLine | null) => void;
  /** Replace the whole cart (a restored abandoned cart) and open the drawer. */
  restore: (lines: RoCartLine[]) => void;
  open: () => void;
  close: () => void;
}

export const useRoCart = create<RoCartStore>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      addItem: (line) =>
        set((s) => {
          const existing = s.items.find((i) => i.slug === line.slug);
          if (existing) {
            if (existing.quantity >= (line.stock ?? existing.stock ?? Infinity)) return { ...s, isOpen: true };
            return { items: s.items.map((i) => (i.slug === line.slug ? { ...i, ...line, quantity: i.quantity + 1 } : i)), isOpen: true };
          }
          return { items: [...s.items, { ...line, quantity: 1 }], isOpen: true };
        }),
      removeItem: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQuantity: (slug, quantity) =>
        set((s) => ({
          items: quantity < 1
            ? s.items.filter((i) => i.slug !== slug)
            : s.items.map((i) => (i.slug === slug ? { ...i, quantity: Math.min(quantity, i.stock ?? Infinity) } : i)),
        })),
      clear: () => set({ items: [] }),
      reprice: (fn) => set((s) => ({ items: s.items.map(fn).filter((l): l is RoCartLine => l !== null) })),
      restore: (lines) => set({ items: lines, isOpen: true }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    // skipHydration: the cart is restored from localStorage after mount (RoProviders), so server HTML and the first
    // client render agree.
    { name: "lr-ro-cart", partialize: (s) => ({ items: s.items }), skipHydration: true },
  ),
);
