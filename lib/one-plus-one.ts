// "1+1 groups": buy two products of a group, the cheaper one is free (3 -> pay 2, 4 -> pay 2, ...). ONE place for the rule, so
// the carts, the product pages, /api/order, /api/order-ro, Stripe, the e-mails and the panel all compute the same numbers.
// Pure (no React, no server imports, no catalog import): a group is just a set of product slugs plus its switches and wording.
//
//   - every group is counted on its own, never mixed: 1 cardholder + 1 item of another group = no 1+1;
//   - the 1+1 is part of the cart's "set discounts" (lib/bundles.ts calcBundleDiscount, lib/ro/pricing.ts roBundleDiscount), so
//     free delivery (judged on the goods after it) and the card -5% (taken after it, same €25 cap) follow automatically;
//   - a group's items never take a promo code (the 1+1 is their promotion);
//   - `fixedPrice`: while the group runs, every product of it sells at this EUR price with NO struck-through price (EU Omnibus:
//     not a sale) - applied to the catalog in lib/products.ts. Turning the group off brings back the catalog's own prices.
//
//   - a group without `fixedPrice` (the jewellery: €109 / €115) keeps its catalog prices: two items cost the dearer one, and its
//     wording (`line`) gets no price. The product-page "add 2" button shows the pair's price (opoPairPrice).
//
// Adding a group: add an entry to ONE_PLUS_ONE_GROUPS - nothing else has to change.

import { NEW_COLLECTION_SLUGS } from "./new-collection";

export type OpoLang = "bg" | "ro";

export interface OnePlusOneGroup {
  id: string;
  slugs: ReadonlySet<string>;
  /** The on/off switch. false = the products sell at their catalog prices again and no 1+1 applies. */
  enabled: boolean;
  /** Optional last moment of the offer (ISO with offset, e.g. Sofia time "+02:00"). */
  endsAt?: string;
  /** EUR price of every product of the group while it runs (replaces price / originalPrice / sale badge). */
  fixedPrice?: number;
  /** When the cart suggests one more: "odd" (1, 3, 5 items - the next one is free) or "single" (exactly one). */
  nudge: "odd" | "single";
  text: Record<OpoLang, {
    badge: string;
    /** The line under the price; `price` is the group's fixed price formatted for the market (e.g. "€65" / "341 lei"). A group
     *  without a fixed price gets empty strings: its wording must not use them. */
    line: (price: { one: string; half: string }) => string;
    /** The cart's suggestion when one more item would be free. */
    addOne: string;
    /** The home-page banner above the group's row: the badge, then this ("2 картодържателя ... за €65"). */
    banner: (price: { one: string }) => string;
    /** The banner's button (to the group's listing). */
    cta: string;
    /** The top black bar's line (desktop / phone). */
    bar: (price: { one: string }) => { desktop: string; mobile: string };
    /** Product page: the heading over the second-item picker. */
    pickTitle: string;
    /** Product page: the add button with a second item picked; `one` = what the two cost (the dearer one). */
    addPair: (price: { one: string }) => string;
    /** The short name under a picker / cart-nudge thumbnail. */
    shortName: (name: string) => string;
  }>;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

/** SWITCH: true = cardholders at €65 with 1+1. false = back to the old prices (€34 / €39 with €65 crossed out), no 1+1. */
export const CARDHOLDER_ONE_PLUS_ONE = true;

/** SWITCH: true = the 2026 jewellery collection's 1+1 (its own group: never mixed with the cardholders). */
export const JEWELLERY_ONE_PLUS_ONE = true;

// 'Lorenzo Ricci "Ambra"' -> "Ambra"; "Колие Verdis – Злато" -> "Verdis Злато" (the photo tells necklace from bracelet).
const quotedModel = (name: string): string => name.match(/"([^"]+)"/)?.[1] ?? name;
const jewelleryModel = (name: string): string => name.replace(/^\S+\s+/, "").replace(/\s+–\s+/, " ");

export const CARDHOLDER_SLUGS = [
  "cardholder-ambra", "cardholder-bianco", "cardholder-valentina", "cardholder-zaffiro", "cardholder-onice", "cardholder-giada",
  "cardholder-cremisi", "cardholder-perla", "cardholder-topazio", "cardholder-marina", "cardholder-panna",
] as const;

export const ONE_PLUS_ONE_GROUPS: OnePlusOneGroup[] = [
  {
    id: "cardholders",
    slugs: new Set<string>(CARDHOLDER_SLUGS),
    enabled: CARDHOLDER_ONE_PLUS_ONE,
    fixedPrice: 65,
    nudge: "odd",
    text: {
      bg: {
        badge: "1+1 БЕЗПЛАТНО",
        line: ({ one, half }) => `2 картодържателя за ${one} – по ${half} на брой. Един за Вас, един за подарък.`,
        addOne: "Добавете още един картодържател – безплатно",
        banner: ({ one }) => `2 картодържателя от крокодилска кожа за ${one}`,
        cta: "Към картодържателите",
        bar: ({ one }) => ({ desktop: `1+1 на картодържатели – 2 за ${one}`, mobile: `1+1 картодържатели – 2 за ${one}` }),
        pickTitle: "Изберете втория – безплатно:",
        addPair: ({ one }) => `Добави 2 в количката – ${one}`,
        shortName: quotedModel,
      },
      ro: {
        badge: "1+1 GRATUIT",
        line: ({ one, half }) => `2 port-carduri pentru ${one} – ${half} bucata. Unul pentru dumneavoastră, unul cadou.`,
        addOne: "Adăugați încă un port-card – gratuit",
        banner: ({ one }) => `2 port-carduri din piele de crocodil pentru ${one}`,
        cta: "Vedeți port-cardurile",
        bar: ({ one }) => ({ desktop: `1+1 la port-carduri – 2 pentru ${one}`, mobile: `1+1 port-carduri – ${one}` }), // short: the BG · RO switch sits beside it on phones
        pickTitle: "Alegeți-l pe al doilea – gratuit:",
        addPair: ({ one }) => `Adaugă 2 în coș – ${one}`, // same voice as the page's "ADAUGĂ ÎN COȘ"
        shortName: quotedModel,
      },
    },
  },
  {
    // The 2026 women's collection (lib/new-collection.ts): any 2 pieces, the cheaper one free. No fixed price (€109 / €115).
    id: "jewellery",
    slugs: NEW_COLLECTION_SLUGS,
    enabled: JEWELLERY_ONE_PLUS_ONE,
    endsAt: "2026-12-31T23:59:59+02:00", // 31.12.2026 23:59 Sofia (EET, UTC+2)
    nudge: "single",
    text: {
      bg: {
        badge: "1+1 БЕЗПЛАТНО",
        line: () => "Второто бижу е подарък",
        addOne: "Добавете още едно бижу – то е безплатно",
        banner: () => "Второто бижу от новата колекция е подарък",
        cta: "Към бижутата",
        bar: () => ({ desktop: "1+1 на новите бижута – второто е подарък", mobile: "1+1 на новите бижута" }),
        pickTitle: "Изберете второто бижу – безплатно:",
        addPair: ({ one }) => `Добави 2 в количката – ${one}`,
        shortName: jewelleryModel,
      },
      ro: {
        badge: "1+1 GRATUIT",
        line: () => "A doua bijuterie este cadou",
        addOne: "Adăugați încă o bijuterie – este gratuită",
        banner: () => "A doua bijuterie din noua colecție este cadou",
        cta: "Vedeți bijuteriile",
        bar: () => ({ desktop: "1+1 la noile bijuterii – a doua este cadou", mobile: "1+1 bijuterii noi" }),
        pickTitle: "Alegeți a doua bijuterie – gratuit:",
        addPair: ({ one }) => `Adaugă 2 în coș – ${one}`,
        shortName: jewelleryModel,
      },
    },
  },
];

// ─── Lookups ─────────────────────────────────────────────────────────────────

export const groupActive = (g: OnePlusOneGroup, now: Date = new Date()): boolean =>
  g.enabled && (!g.endsAt || now.getTime() <= Date.parse(g.endsAt));

/** The running group a product belongs to, or undefined. */
export const opoGroupOf = (slug: string | undefined | null, now?: Date): OnePlusOneGroup | undefined =>
  slug ? ONE_PLUS_ONE_GROUPS.find((g) => g.slugs.has(slug) && groupActive(g, now)) : undefined;

/** The id of a group's discount line in the cart ("1+1:cardholders"). */
export const opoLineId = (groupId: string): string => `1+1:${groupId}`;
export const isOpoLineId = (id: string | undefined): boolean => !!id && id.startsWith("1+1:");

/**
 * The catalog product as it sells while its group runs with a fixed price: that price, no struck-through price, no sale badge
 * (the 1+1 badge is drawn by the cards and pages). Anything else is returned unchanged.
 */
export function withOnePlusOnePrice<T extends { slug: string; price: number; originalPrice?: number; badge?: string }>(p: T): T {
  const g = opoGroupOf(p.slug);
  if (!g || typeof g.fixedPrice !== "number") return p;
  return { ...p, price: g.fixedPrice, originalPrice: undefined, badge: undefined };
}

/** True when the product's price is set by a running 1+1 group (price overrides and sale badges must not touch it). */
export const opoFixesPrice = (slug: string): boolean => typeof opoGroupOf(slug)?.fixedPrice === "number";

// ─── Maths ───────────────────────────────────────────────────────────────────

/** One cart line as the 1+1 sees it: unit price in the cart's currency (EUR with cents, or whole lei). */
export type OpoLine = { slug: string; unit: number; quantity: number; onSale?: boolean };

const round2 = (n: number): number => Math.round(n * 100) / 100;

function unitsOf(g: OnePlusOneGroup, lines: OpoLine[]): number[] {
  const units: number[] = [];
  for (const l of lines) {
    if (!g.slugs.has(l.slug) || l.onSale || !(l.unit > 0)) continue;
    const q = Math.max(0, Math.min(Math.floor(l.quantity), 1000));
    for (let i = 0; i < q; i++) units.push(l.unit);
  }
  return units;
}

/** Of every two units the cheaper is free: with 2n or 2n+1 units, the n cheapest. */
function freeOf(units: number[]): number {
  const sorted = [...units].sort((a, b) => b - a);
  const free = Math.floor(sorted.length / 2);
  return round2(sorted.slice(sorted.length - free).reduce((s, u) => s + u, 0));
}

/** The 1+1 of every running group, each counted on its own. `ignoreSchedule`: the maths alone (reading back a saved order). */
export function onePlusOne(lines: OpoLine[], opts: { now?: Date; ignoreSchedule?: boolean } = {}): { total: number; groups: { id: string; discount: number }[] } {
  const groups: { id: string; discount: number }[] = [];
  for (const g of ONE_PLUS_ONE_GROUPS) {
    if (!opts.ignoreSchedule && !groupActive(g, opts.now)) continue;
    const discount = freeOf(unitsOf(g, lines));
    if (discount > 0) groups.push({ id: g.id, discount });
  }
  return { total: round2(groups.reduce((s, g) => s + g.discount, 0)), groups };
}

/** The running groups whose next item would be free right now (the cart suggests one more of them). */
export function opoNudges(lines: OpoLine[], now?: Date): OnePlusOneGroup[] {
  return ONE_PLUS_ONE_GROUPS.filter((g) => {
    if (!groupActive(g, now)) return false;
    const n = unitsOf(g, lines).length;
    return g.nudge === "odd" ? n % 2 === 1 : n === 1;
  });
}

/** Items of a running group never take a promo code. */
export const opoExcludedFromPromo = (slug: string): boolean => !!opoGroupOf(slug);

/**
 * The 1+1 part of a SAVED order (e-mails, panel), from its own lines (they carry slug + the charged unit price) and the order's
 * total discount (lines - goods after discounts - promo). An order whose discounts don't cover it (placed while the offer was off)
 * shows none.
 */
export function onePlusOneOfOrder(
  items: { slug?: unknown; price?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown }[],
  orderDiscount: number,
): number {
  const lines: OpoLine[] = items
    .filter((i) => !i.gift && typeof i.slug === "string")
    .map((i) => ({ slug: String(i.slug), unit: Number(i.price ?? 0), quantity: Number(i.quantity ?? i.qty ?? 1) }));
  const free = onePlusOne(lines, { ignoreSchedule: true }).total;
  return free > 0 && orderDiscount + 0.01 >= free ? free : 0;
}

// ─── Wording helpers ─────────────────────────────────────────────────────────

const eur = (n: number): string => `€${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;

/** The running cardholder group (home banner, top bar, product-page picker), or undefined while it is off / over. */
export const cardholderOpo = (now?: Date): OnePlusOneGroup | undefined => {
  const g = ONE_PLUS_ONE_GROUPS.find((x) => x.id === "cardholders");
  return g && groupActive(g, now) && typeof g.fixedPrice === "number" ? g : undefined;
};

/** A group's fixed price as the BG site writes it ("€65"). */
export const opoPriceBg = (g: OnePlusOneGroup): string => eur(g.fixedPrice ?? 0);

/** What a pair costs with the 1+1 (the cheaper one free = the dearer price), in the cart's own unit (EUR, or lei). */
export const opoPairPrice = (a: number, b: number): number => Math.max(a, b);

/** The pair price as the BG site writes it ("€115"). */
export const opoPairPriceBg = (a: number, b: number): string => eur(opoPairPrice(a, b));

/** The line under the price for a product of a running group (BG site, EUR). A group without a fixed price: its plain line. */
export function opoPriceLineBg(slug: string): string | null {
  const g = opoGroupOf(slug);
  if (!g) return null;
  if (typeof g.fixedPrice !== "number") return g.text.bg.line({ one: "", half: "" });
  return g.text.bg.line({ one: eur(g.fixedPrice), half: eur(g.fixedPrice / 2) });
}
