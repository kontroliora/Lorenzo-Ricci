// "Часовник + кардхолдър ПОДАРЪК" (owner, 14.11.2026), BG site only: every watch comes with ONE free crocodile cardholder of the
// customer's choice (one per watch: 2 watches = 2 cardholders). ONE place for the switch, the end date and the wording.
// Pure (no React, no catalog import), so the product page, the cards, the cart, the checkout and /api/order read the same rule.
//
//   - The chosen cardholder rides on the watch's cart line (CartItem.giftSlugs, at most one per unit). It is NEVER a cart item:
//     it stays out of the subtotal, free delivery, the 1+1 / set discounts, the card -5% and the Meta value by construction.
//   - /api/order re-derives it from the watch lines (lib/gifts.ts reserveWithGifts): the cardholder's stock is reserved with the
//     watch in one all-or-nothing call, and it becomes an order line at price 0 (gift: true) - so the e-mails, the panel, the
//     partner view and every restock (cancel / return / Econt) treat it like the clutch gifts.
//   - After WATCH_GIFT_PROMO.endsAt (or with enabled: false) everything returns to normal on its own: no badge, no bar line, no
//     box 2, no reminder, and the server ignores any giftSlugs still in an old cart.

import { CARDHOLDER_SLUGS } from "./one-plus-one";

/** SWITCH + last moment of the offer: 24.12.2026 23:59 Sofia (EET, UTC+2). */
export const WATCH_GIFT_PROMO = {
  enabled: true,
  endsAt: "2026-12-24T23:59:59+02:00",
} as const;

export const watchGiftActive = (now: Date = new Date()): boolean =>
  WATCH_GIFT_PROMO.enabled && now.getTime() <= Date.parse(WATCH_GIFT_PROMO.endsAt);

/** Every cardholder can be the gift (the page greys out the sold-out ones). */
export const WATCH_GIFT_CHOICES: readonly string[] = CARDHOLDER_SLUGS;
export const isWatchGiftChoice = (slug: unknown): slug is string => typeof slug === "string" && WATCH_GIFT_CHOICES.includes(slug);

export const WATCH_GIFT_TEXT = {
  /** Red badge by the price (product page) and on the listing cards. */
  badge: "+ КАРДХОЛДЪР ПОДАРЪК",
  /** Top black bar. */
  bar: { desktop: "Часовник + кардхолдър от крокодилска кожа ПОДАРЪК · до 24.12", mobile: "Часовник + кардхолдър ПОДАРЪК · до 24.12" },
  /** Cart reminder when a watch has no cardholder chosen. */
  reminderTitle: "Забравихте подаръка си – кардхолдър от крокодилска кожа",
  reminderSub: "Към всеки часовник получавате кардхолдър от крокодилска кожа безплатно. Изберете го с едно докосване:",
  reminderAdd: "Избери подарък",
  reminderDecline: "Продължи без подарък",
  free: "Подарък",
  /** Cardholder pages: a small line under the price, linking to the watches. */
  cardholderLine: "Подарък към всеки часовник до 24.12",
} as const;

/**
 * The watch lines' chosen gifts, merged per (watch, cardholder) - what the server reserves and what the cart shows.
 * A line gets at most one cardholder per unit; anything that is not a cardholder is dropped. Inactive offer = none.
 */
export function watchGiftSlots(
  lines: { slug: string; qty: number; giftSlugs?: unknown; isWatch: boolean }[],
  now?: Date,
): { watchSlug: string; giftSlug: string; qty: number }[] {
  if (!watchGiftActive(now)) return [];
  const out = new Map<string, { watchSlug: string; giftSlug: string; qty: number }>();
  for (const l of lines) {
    if (!l.isWatch || !Array.isArray(l.giftSlugs)) continue;
    const chosen = l.giftSlugs.filter(isWatchGiftChoice).slice(0, Math.max(0, Math.floor(l.qty)));
    for (const giftSlug of chosen) {
      const key = `${l.slug}|${giftSlug}`;
      const slot = out.get(key) ?? { watchSlug: l.slug, giftSlug, qty: 0 };
      slot.qty += 1;
      out.set(key, slot);
    }
  }
  return [...out.values()];
}
