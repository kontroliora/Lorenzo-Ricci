import type { CartItem } from "./types";
import type { RecoveryPrefill } from "./store";
import { getProductBySlug } from "./products";

// Paying by card sends the browser to Stripe and back with full page loads, and the cart store lives in memory only.
// So the checkout leaves a small snapshot (slugs, quantities, the contact details) in sessionStorage right before the
// redirect, and the "payment cancelled" page rebuilds the cart from it - that is what makes "your cart is kept" true.
// The snapshot is tied to the order reference, expires after two hours and holds no prices (the catalog is the source).

const KEY = "lr_card_cart";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

type Snapshot = {
  ref: string;
  ts: number;
  items: { slug: string; quantity: number }[];
  prefill: RecoveryPrefill;
};

export function saveCardCartSnapshot(ref: string, items: CartItem[], prefill: RecoveryPrefill): void {
  try {
    const snap: Snapshot = {
      ref,
      ts: Date.now(),
      items: items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })),
      prefill,
    };
    sessionStorage.setItem(KEY, JSON.stringify(snap));
  } catch { /* private mode / storage full: the customer just starts a fresh cart */ }
}

/** The cart saved before the redirect to Stripe, rebuilt from the live catalog. `ref` (when given) must match. */
export function loadCardCartSnapshot(ref?: string | null): { items: CartItem[]; prefill: RecoveryPrefill } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as Partial<Snapshot> | null;
    if (!snap || !Array.isArray(snap.items)) return null;
    if (typeof snap.ts !== "number" || Date.now() - snap.ts > MAX_AGE_MS) return null;
    if (ref && snap.ref !== ref) return null;

    const items: CartItem[] = [];
    for (const it of snap.items) {
      const product = it && typeof it.slug === "string" ? getProductBySlug(it.slug) : undefined;
      if (product) items.push({ product, quantity: Math.max(1, Number(it.quantity) || 1) });
    }
    if (items.length === 0) return null;

    const p = snap.prefill ?? {};
    return {
      items,
      prefill: {
        name:  typeof p.name  === "string" ? p.name  : undefined,
        email: typeof p.email === "string" ? p.email : undefined,
        phone: typeof p.phone === "string" ? p.phone : undefined,
      },
    };
  } catch {
    return null;
  }
}

export function clearCardCartSnapshot(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
