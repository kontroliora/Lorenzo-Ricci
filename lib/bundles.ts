import type { CartItem, Product } from "./types";
import { isOnSale } from "./price";

export interface Bundle {
  id: string;
  label: string;
  // Each slot is a list of product IDs — any one of them satisfies the slot
  slots: string[][];
  discountPct: number;
}

export const BUNDLES: Bundle[] = [
  {
    id: "aurelius-signature-pair",
    label: "Aurelius Cross + Signature Комплект",
    slots: [
      ["necklace-aurelius"],
      ["bracelet-signature"],
    ],
    discountPct: 10,
  },
  {
    id: "milano-twist-pair",
    label: "Milano Twist Комплект",
    slots: [
      ["bracelet-milano-twist"],
      ["necklace-milano-twist"],
    ],
    discountPct: 10,
  },
  {
    id: "milano-forte-pair",
    label: "Milano Forte Комплект",
    slots: [
      ["bracelet-milano-forte"],
      ["necklace-milano-forte"],
    ],
    discountPct: 10,
  },
  {
    id: "bianco-alabastro-pair",
    label: "Bianco + Alabastro Комплект",
    slots: [["cardholder-bianco"], ["wallet-alabastro"]],
    discountPct: 0,
  },
  {
    id: "zaffiro-alabastro-pair",
    label: "Zaffiro + Alabastro Комплект",
    slots: [["cardholder-zaffiro"], ["wallet-alabastro"]],
    discountPct: 0,
  },
];

export interface BundleResult {
  totalDiscount: number;
  active: { label: string; discount: number }[];
}

export function calcBundleDiscount(items: CartItem[]): BundleResult {
  const inCart = new Set(items.map((i) => i.product.id));
  let totalDiscount = 0;
  const active: { label: string; discount: number }[] = [];

  for (const bundle of BUNDLES) {
    const allSlotsMatched = bundle.slots.every((slot) =>
      slot.some((id) => inCart.has(id))
    );
    if (!allSlotsMatched) continue;

    // No stacking: a set with a sale item in it earns no set discount.
    const matchedItems = bundle.slots.map((slot) => items.find((i) => i.product.id === slot.find((id) => inCart.has(id))));
    if (matchedItems.some((i) => i && isOnSale(i.product))) continue;

    // Sum the price of the matched item in each slot
    const bundleSubtotal = bundle.slots.reduce((sum, slot) => {
      const matchedId = slot.find((id) => inCart.has(id))!;
      const item = items.find((i) => i.product.id === matchedId);
      return sum + (item ? item.product.price * item.quantity : 0);
    }, 0);

    const discount = Math.round(bundleSubtotal * bundle.discountPct) / 100;
    totalDiscount += discount;
    if (discount > 0) active.push({ label: bundle.label, discount });
  }

  return { totalDiscount, active };
}

// True when any product that can fill one of the set's slots is on sale — such a
// set earns no set discount, so pages mustn't advertise one for it.
export function bundleHasSaleItem(bundle: Bundle, findProduct: (id: string) => Product | undefined): boolean {
  return bundle.slots.some((slot) => slot.some((id) => { const p = findProduct(id); return !!p && isOnSale(p); }));
}

// A set is sold out as soon as ANY of its slots can't be filled: a slot is filled by any
// one of its products that is switched on in the catalog and has free stock. Stock the
// storefront doesn't know yet (undefined) counts as available - the browser shows the
// optimistic state first, and /api/order stays the real judge (reserve_wallet_stock is
// all-or-nothing across every line, so a set is never half-sold).
export function bundleSoldOut(
  bundle: Pick<Bundle, "slots">,
  stockOf: (slug: string) => number | undefined,
  isOn: (slug: string) => boolean,
): boolean {
  return bundle.slots.some((slot) =>
    slot.every((slug) => !isOn(slug) || (stockOf(slug) ?? 1) <= 0),
  );
}

// What a promo code (newsletter / waitlist) applies to: full-price items only, after
// their set discounts (sale items can't earn one). No stacking on sale items.
export function promoBase(items: CartItem[], setDiscount: number): number {
  const fullPrice = items
    .filter((i) => !isOnSale(i.product))
    .reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  return Math.max(0, Math.round((fullPrice - setDiscount) * 100) / 100);
}
