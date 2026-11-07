import type { CartItem, Product } from "./types";
import { isOnSale } from "./price";
import { onePlusOne, opoLineId, isOpoLineId, opoExcludedFromPromo, opoGroupOf, type OpoLine } from "./one-plus-one";
import { COLLECTION_SETS } from "./new-collection";

export interface Bundle {
  id: string;
  label: string;
  // Each slot is a list of product IDs — any one of them satisfies the slot
  slots: string[][];
  discountPct: number;
  // A set of the 2026 collection: no set % of its own - its saving is the jewellery 1+1 group (lib/one-plus-one.ts).
  onePlusOne?: boolean;
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
  // 2026 women's collection: "Комплект Verdis / Noctis / Lumen" (necklace + bracelet, same metal).
  ...COLLECTION_SETS.map((s) => ({ id: s.id, label: s.label, slots: s.slots, discountPct: 0, onePlusOne: true })),
];

/** A 1+1 set (the collection's): its saving is its pieces' 1+1 group, so it is advertised only while that group runs. */
export const bundleOpoRunning = (bundle: Bundle): boolean => !!bundle.onePlusOne && !!opoGroupOf(bundle.slots[0]?.[0]);

/** True while the set saves something: its own % (no sale item in it) or, for a collection set, its running 1+1 group. */
export const bundleSaves = (bundle: Bundle, findProduct: (id: string) => Product | undefined): boolean =>
  bundle.onePlusOne ? bundleOpoRunning(bundle) : bundle.discountPct > 0 && !bundleHasSaleItem(bundle, findProduct);

export interface BundleResult {
  totalDiscount: number;
  // id: the set's id, or "1+1:<group>" for a 1+1 line (lib/one-plus-one.ts); pct: the set's % (absent on a 1+1 line)
  active: { id: string; label: string; discount: number; pct?: number }[];
}

/** The cart lines as the 1+1 groups see them. */
export const opoLines = (items: CartItem[]): OpoLine[] =>
  items.map((i) => ({ slug: i.product.slug, unit: i.product.price, quantity: i.quantity, onSale: isOnSale(i.product) }));

/** How a discount line reads in the cart and the checkout: "Milano Twist Комплект -10%" / "1+1". */
export const bundleLineText = (b: { id: string; label: string; pct?: number }): string =>
  isOpoLineId(b.id) ? "1+1" : `${b.label} -${b.pct ?? 10}%`;

export function calcBundleDiscount(items: CartItem[]): BundleResult {
  const inCart = new Set(items.map((i) => i.product.id));
  let totalDiscount = 0;
  const active: BundleResult["active"] = [];

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
    if (discount > 0) active.push({ id: bundle.id, label: bundle.label, discount, pct: bundle.discountPct });
  }

  // 1+1 groups (lib/one-plus-one.ts), each on its own. Same field as the set discounts, so /api/order, Stripe, the card -5%
  // (taken after it), free delivery (judged after it) and abandoned-cart recovery all see it.
  for (const g of onePlusOne(opoLines(items)).groups) {
    totalDiscount += g.discount;
    active.push({ id: opoLineId(g.id), label: "1+1", discount: g.discount });
  }
  totalDiscount = Math.round(totalDiscount * 100) / 100;

  return { totalDiscount, active };
}

// True when any product that can fill one of the set's slots is on sale — such a
// set earns no set discount, so pages mustn't advertise one for it.
export function bundleHasSaleItem(bundle: Bundle, findProduct: (id: string) => Product | undefined): boolean {
  return bundle.slots.some((slot) => slot.some((id) => { const p = findProduct(id); return !!p && isOnSale(p); }));
}

/** True while at least one set can be bought WITH its set discount: every slot has a product switched on and none is on sale
 *  (sale items get no set discount). The menu links to the sets page only then. */
export function bundleOfferLive(findProduct: (id: string) => Product | undefined): boolean {
  return BUNDLES.some((b) =>
    bundleSaves(b, findProduct) &&
    b.slots.every((slot) => slot.some((id) => findProduct(id)?.inStock === true)),
  );
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
// Items of a running 1+1 group never take a code either (the 1+1 is their promotion): they and the 1+1 part of `setDiscount`
// are left out.
export function promoBase(items: CartItem[], setDiscount: number): number {
  const fullPrice = items
    .filter((i) => !isOnSale(i.product) && !opoExcludedFromPromo(i.product.slug))
    .reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const otherSets = setDiscount - onePlusOne(opoLines(items)).total;
  return Math.max(0, Math.round((fullPrice - otherSets) * 100) / 100);
}
