import type { CartItem } from "./types";

interface Bundle {
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
    id: "valentina-rubino-pair",
    label: "Valentina + Rubino Комплект",
    slots: [["cardholder-valentina"], ["wallet-rubino"]],
    discountPct: 0,
  },
  {
    id: "ambra-rubino-pair",
    label: "Ambra + Rubino Комплект",
    slots: [["cardholder-ambra"], ["wallet-rubino"]],
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
