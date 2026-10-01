// Gift cardholder with every clutch bag. One source of truth for the offer: the storefront
// (product page, cards, cart, checkout) and /api/order both read it, so they can't drift.
// Pure on purpose: no catalog import and no I/O - callers pass in stock and the catalog's
// on/off switch.
//
// A gift is NEVER a cart item. It is derived from the paid lines, which keeps it out of every
// price calculation (subtotal, free-shipping threshold, set / promo discounts, Meta value)
// by construction, and a client can't change it or buy one at 0 - /api/order re-derives it
// and the price guard rejects any line that isn't at its catalog price.

const GIFT_PAIRS = new Map<string, string>([
  ["clutch-toscana", "cardholder-giada"],
  ["clutch-capri", "cardholder-zaffiro"],
  ["clutch-portofino", "cardholder-bianco"],
  ["clutch-torino", "cardholder-onice"],
  ["clutch-verona", "cardholder-cremisi"],
]);

// When the matching cardholder can't cover the line, the gift becomes this one instead.
export const GIFT_FALLBACK = "cardholder-bianco";

export const isGiftClutch = (slug: string): boolean => GIFT_PAIRS.has(slug);

// Cardholders that can fill a clutch's gift, best first: the matching one, then the fallback.
export function giftCandidates(clutchSlug: string): string[] {
  const primary = GIFT_PAIRS.get(clutchSlug);
  if (!primary) return [];
  return primary === GIFT_FALLBACK ? [primary] : [primary, GIFT_FALLBACK];
}

// "clutch-toscana" -> "Toscana", "cardholder-giada" -> "Giada"
export function shortModelName(slug: string): string {
  const rest = slug.split("-").slice(1).join(" ");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export const giftDisplayName = (giftSlug: string): string => `Кардхолдър ${shortModelName(giftSlug)}`;

export const giftOfferText = (clutchSlug: string, giftSlug: string): string =>
  `При покупка на ${shortModelName(clutchSlug)} получаваш кардхолдър ${shortModelName(giftSlug)} безплатно`;

// Units free to sell for a slug; undefined = not known (yet).
export type StockOf = (slug: string) => number | undefined;
// The catalog's hard on/off switch (inStock) - a switched-off cardholder is never gifted.
export type Usable = (slug: string) => boolean;

export type GiftLine = { clutchSlug: string; giftSlug: string; qty: number; swapped: boolean };

// The cardholder a line would get right now. Unknown stock counts as available (the storefront
// shows the matching one until the live numbers arrive; the server is the real judge).
export function pickGift(clutchSlug: string, qty: number, stockOf: StockOf, usable: Usable): string | null {
  for (const slug of giftCandidates(clutchSlug)) {
    if (!usable(slug)) continue;
    const n = stockOf(slug);
    if (n === undefined || n >= qty) return slug;
  }
  return null;
}

// Storefront: the gift rows to show for the paid cart lines (display only).
export function deriveGiftLines(lines: { slug: string; qty: number }[], stockOf: StockOf, usable: Usable): GiftLine[] {
  const out: GiftLine[] = [];
  for (const l of lines) {
    const candidates = giftCandidates(l.slug);
    if (!candidates.length) continue;
    const giftSlug = pickGift(l.slug, l.qty, stockOf, usable);
    if (giftSlug) out.push({ clutchSlug: l.slug, giftSlug, qty: l.qty, swapped: giftSlug !== candidates[0] });
  }
  return out;
}

export type Shortfall = { slug: string; available: number };
export type ReserveFn = (
  items: { slug: string; qty: number }[],
) => Promise<{ ok: true } | { ok: false; shortfall: Shortfall[] }>;
export type MissedGift = { clutchSlug: string; wantedSlug: string; qty: number };
export type GiftReservation =
  | { ok: true; gifts: GiftLine[]; missed: MissedGift[] }
  | { ok: false; shortfall: Shortfall[] };

// Server: reserve the paid goods together with their gifts in one all-or-nothing call.
//   - Quantities are merged per slug first: reserve_wallet_stock checks and decrements each
//     array entry separately, so "2 paid Giada + 1 gift Giada" as two entries could oversell.
//   - If only a gift is short, that line moves on (matching cardholder -> fallback -> none) and
//     the reservation is retried. A gift never blocks the paid goods.
//   - If a PAID item is short, nothing is reserved and only the paid shortfall is returned.
// Every failed round moves at least one gift on, so the loop always ends.
export async function reserveWithGifts(
  paid: { slug: string; qty: number }[],
  reserve: ReserveFn,
  usable: Usable,
): Promise<GiftReservation> {
  const paidBySlug = new Map<string, number>();
  for (const l of paid) paidBySlug.set(l.slug, (paidBySlug.get(l.slug) ?? 0) + l.qty);

  type Slot = { clutchSlug: string; qty: number; wanted: string; candidates: string[]; at: number };
  const slots: Slot[] = [];
  paidBySlug.forEach((qty, clutchSlug) => {
    const all = giftCandidates(clutchSlug);
    if (all.length) slots.push({ clutchSlug, qty, wanted: all[0], candidates: all.filter(usable), at: 0 });
  });

  for (;;) {
    const gifts: GiftLine[] = [];
    for (const s of slots) {
      if (s.at < s.candidates.length) {
        gifts.push({ clutchSlug: s.clutchSlug, giftSlug: s.candidates[s.at], qty: s.qty, swapped: s.candidates[s.at] !== s.wanted });
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

    let moved = false;
    for (const sf of res.shortfall) {
      for (const s of slots) {
        if (s.at < s.candidates.length && s.candidates[s.at] === sf.slug) {
          s.at++;
          moved = true;
        }
      }
    }
    if (!moved) return { ok: false, shortfall: res.shortfall };
  }
}

// Customer-facing notes when the order ended up with a different gift (or none) than the
// storefront promised. Shown on the success screen and in the confirmation email.
export function giftNotes(r: { gifts: GiftLine[]; missed: MissedGift[] }): string[] {
  const notes: string[] = [];
  for (const g of r.gifts) {
    if (!g.swapped) continue;
    const wanted = giftCandidates(g.clutchSlug)[0];
    notes.push(
      `Кардхолдър ${shortModelName(wanted)} вече не е наличен - към ${shortModelName(g.clutchSlug)} получавате кардхолдър ${shortModelName(g.giftSlug)} като подарък.`,
    );
  }
  for (const m of r.missed) {
    notes.push(
      `Подаръкът към ${shortModelName(m.clutchSlug)} (кардхолдър ${shortModelName(m.wantedSlug)}) вече не е наличен, затова поръчката е без него.`,
    );
  }
  return notes;
}
