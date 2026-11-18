// Free cardholder with every clutch bag (BG site). One source of truth for the offer: the storefront (product page, cards, cart,
// checkout) and /api/order both read it, so they can't drift. Pure on purpose: no catalog import and no I/O - callers pass in
// stock and the catalog's on/off switch.
//
// Since 18.11.2026 (owner) the customer CHOOSES the cardholder, with the same step 2 as the watches' gift and the jewellery 1+1
// ("2. Изберете кардхолдър – БЕЗПЛАТНО", components/product/CollectionTwoBoxes.tsx). The matching colour is pre-selected when it
// is in stock, else the first one in stock; when none is left the clutch sells alone. The choice rides on the clutch's cart line
// (CartItem.giftSlugs, one per unit, like the watches) and is NEVER a cart item: it stays out of every price calculation by
// construction, and a client can't buy one at 0 - /api/order reserves it with the clutch (strict: a chosen cardholder that ran out
// is a clear error that sends the customer back to the choice, never a silent swap) and the price guard rejects any paid line
// that isn't at its catalog price.

import { CARDHOLDER_SLUGS } from "./one-plus-one";

// The clutch -> its matching-colour cardholder (pre-selected, "Съвпадащ цвят").
const GIFT_PAIRS = new Map<string, string>([
  ["clutch-toscana", "cardholder-giada"],
  ["clutch-capri", "cardholder-zaffiro"],
  ["clutch-portofino", "cardholder-bianco"],
  ["clutch-torino", "cardholder-onice"],
  ["clutch-verona", "cardholder-cremisi"],
]);

// The watches' fallback when their chosen cardholder ran out (lib/watch-gift.ts keeps the swap; the clutches don't).
export const GIFT_FALLBACK = "cardholder-bianco";

export const isGiftClutch = (slug: string): boolean => GIFT_PAIRS.has(slug);

/** The cardholder in the clutch's own colour, or undefined. */
export const matchingCardholder = (clutchSlug: string): string | undefined => GIFT_PAIRS.get(clutchSlug);

/** Every cardholder can be a clutch's free one (sold-out ones are greyed on the page). */
export const CLUTCH_GIFT_CHOICES: readonly string[] = CARDHOLDER_SLUGS;
export const isClutchGiftChoice = (slug: unknown): slug is string => typeof slug === "string" && CLUTCH_GIFT_CHOICES.includes(slug);

/** The pre-selected cardholder: the matching colour if available, else the first available one; null = none left. */
export function defaultClutchGift(clutchSlug: string, available: (slug: string) => boolean): string | null {
  const match = GIFT_PAIRS.get(clutchSlug);
  if (match && available(match)) return match;
  return CLUTCH_GIFT_CHOICES.find(available) ?? null;
}

// "clutch-toscana" -> "Toscana", "cardholder-giada" -> "Giada"
export function shortModelName(slug: string): string {
  const rest = slug.split("-").slice(1).join(" ");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export const giftDisplayName = (giftSlug: string): string => `Кардхолдър ${shortModelName(giftSlug)}`;

/** How cart, checkout, e-mails and the panel name a clutch's free cardholder: "Кардхолдър Zaffiro (безплатно) към клъч Capri". */
export const clutchGiftLabel = (clutchSlug: string, giftSlug: string): string =>
  `${giftDisplayName(giftSlug)} (безплатно) към клъч ${shortModelName(clutchSlug)}`;

// Units free to sell for a slug; undefined = not known (yet).
export type StockOf = (slug: string) => number | undefined;
// The catalog's hard on/off switch (inStock) - a switched-off cardholder is never gifted.
export type Usable = (slug: string) => boolean;

// clutchSlug = the paid line the gift belongs to (a clutch, or a watch - lib/watch-gift.ts); wantedSlug = the cardholder that was
// chosen (the notes name the right one when a watch's cardholder had to be swapped).
export type GiftLine = { clutchSlug: string; giftSlug: string; qty: number; swapped: boolean; wantedSlug?: string };

/**
 * The clutch lines' chosen cardholders, merged per (clutch, cardholder) - what the cart shows and the server reserves. A line gets
 * at most one cardholder per unit; anything that is not a cardholder, or sits on a line that is not a clutch, is dropped.
 */
export function clutchGiftSlots(lines: { slug: string; qty: number; giftSlugs?: unknown }[]): { clutchSlug: string; giftSlug: string; qty: number }[] {
  const out = new Map<string, { clutchSlug: string; giftSlug: string; qty: number }>();
  for (const l of lines) {
    if (!isGiftClutch(l.slug) || !Array.isArray(l.giftSlugs)) continue;
    for (const giftSlug of l.giftSlugs.filter(isClutchGiftChoice).slice(0, Math.max(0, Math.floor(l.qty)))) {
      const key = `${l.slug}|${giftSlug}`;
      const slot = out.get(key) ?? { clutchSlug: l.slug, giftSlug, qty: 0 };
      slot.qty += 1;
      out.set(key, slot);
    }
  }
  return [...out.values()];
}

export type Shortfall = { slug: string; available: number };
export type ReserveFn = (
  items: { slug: string; qty: number }[],
) => Promise<{ ok: true } | { ok: false; shortfall: Shortfall[] }>;
export type MissedGift = { clutchSlug: string; wantedSlug: string; qty: number };
/** A strictly chosen gift (a clutch's cardholder) that can't be given: the order is refused and the customer chooses again. */
export type GiftSoldOut = { forSlug: string; giftSlug: string };
export type GiftReservation =
  | { ok: true; gifts: GiftLine[]; missed: MissedGift[] }
  | { ok: false; shortfall: Shortfall[]; giftSoldOut?: GiftSoldOut[] };

// Server: reserve the paid goods together with their gifts in one all-or-nothing call.
//   - Quantities are merged per slug first: reserve_wallet_stock checks and decrements each
//     array entry separately, so "2 paid Giada + 1 gift Giada" as two entries could oversell.
//   - If a PAID item is short, nothing is reserved and only the paid shortfall is returned.
//   - `gifts`: each chosen gift with its candidates in order (the chosen one first, then the fallbacks).
//       strict (a clutch's cardholder): no fallbacks - if the chosen one is short or switched off, nothing is reserved and
//         `giftSoldOut` names it, so the customer picks another (never a silent swap). The paid goods are never short for it.
//       not strict (a watch's cardholder): that line moves on (chosen -> fallbacks -> none) and the reservation is retried;
//         such a gift never blocks the paid goods.
// Every failed round moves at least one gift on (or returns), so the loop always ends.
export async function reserveWithGifts(
  paid: { slug: string; qty: number }[],
  reserve: ReserveFn,
  usable: Usable,
  extra: { forSlug: string; qty: number; candidates: string[]; strict?: boolean }[] = [],
): Promise<GiftReservation> {
  const paidBySlug = new Map<string, number>();
  for (const l of paid) paidBySlug.set(l.slug, (paidBySlug.get(l.slug) ?? 0) + l.qty);

  type Slot = { clutchSlug: string; qty: number; wanted: string; candidates: string[]; at: number; strict: boolean };
  const slots: Slot[] = [];
  const offShelf: GiftSoldOut[] = [];
  for (const e of extra) {
    if (!e.candidates.length || !(e.qty > 0)) continue;
    const strict = e.strict === true;
    const candidates = strict ? [e.candidates[0]] : [...new Set(e.candidates)];
    if (strict && !usable(candidates[0])) { offShelf.push({ forSlug: e.forSlug, giftSlug: candidates[0] }); continue; }
    slots.push({ clutchSlug: e.forSlug, qty: e.qty, wanted: e.candidates[0], candidates: candidates.filter(usable), at: 0, strict });
  }
  if (offShelf.length) return { ok: false, shortfall: [], giftSoldOut: offShelf };

  for (;;) {
    const gifts: GiftLine[] = [];
    for (const s of slots) {
      if (s.at < s.candidates.length) {
        gifts.push({ clutchSlug: s.clutchSlug, giftSlug: s.candidates[s.at], qty: s.qty, swapped: s.candidates[s.at] !== s.wanted, wantedSlug: s.wanted });
      }
    }

    const totals = new Map(paidBySlug);
    for (const g of gifts) totals.set(g.giftSlug, (totals.get(g.giftSlug) ?? 0) + g.qty);
    const items: { slug: string; qty: number }[] = [];
    totals.forEach((qty, slug) => items.push({ slug, qty }));

    const res = await reserve(items);
    if (res.ok) {
      const missed = slots
        .filter((s) => s.at >= s.candidates.length)
        .map((s) => ({ clutchSlug: s.clutchSlug, wantedSlug: s.wanted, qty: s.qty }));
      return { ok: true, gifts, missed };
    }

    const paidShort = res.shortfall.filter((s) => (paidBySlug.get(s.slug) ?? 0) > s.available);
    if (paidShort.length) return { ok: false, shortfall: paidShort };

    const short = new Set(res.shortfall.map((s) => s.slug));
    const strictOut = slots.filter((s) => s.strict && s.at < s.candidates.length && short.has(s.candidates[s.at]));
    if (strictOut.length) return { ok: false, shortfall: [], giftSoldOut: strictOut.map((s) => ({ forSlug: s.clutchSlug, giftSlug: s.candidates[s.at] })) };

    let moved = false;
    for (const s of slots) {
      if (s.at < s.candidates.length && short.has(s.candidates[s.at])) {
        s.at++;
        moved = true;
      }
    }
    if (!moved) return { ok: false, shortfall: res.shortfall };
  }
}

// Customer-facing notes when the order ended up with a different gift (or none) than the
// storefront promised. Shown on the success screen and in the confirmation email.
// `forName`: how the paid line is named ("Toscana" for a clutch by default; the caller passes the watch's name).
export function giftNotes(r: { gifts: GiftLine[]; missed: MissedGift[] }, forName: (slug: string) => string = shortModelName): string[] {
  const notes: string[] = [];
  for (const g of r.gifts) {
    if (!g.swapped) continue;
    const wanted = g.wantedSlug ?? g.giftSlug;
    notes.push(
      `Кардхолдър ${shortModelName(wanted)} вече не е наличен - към ${forName(g.clutchSlug)} получавате кардхолдър ${shortModelName(g.giftSlug)} като подарък.`,
    );
  }
  for (const m of r.missed) {
    notes.push(
      `Подаръкът към ${forName(m.clutchSlug)} (кардхолдър ${shortModelName(m.wantedSlug)}) вече не е наличен, затова поръчката е без него.`,
    );
  }
  return notes;
}
