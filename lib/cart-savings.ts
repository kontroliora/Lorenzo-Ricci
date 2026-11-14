import type { CartItem } from "./types";
import type { GiftLine } from "./gifts";
import { isOnSale } from "./price";
import { getProductBySlug } from "./products";

// The ONE "Спестявате" total of the cart drawer and the checkout summary (owner, 14.11.2026: "must match the cart exactly"):
// every crossed-out price minus the current one + the sets / 1+1 discount + a promo code + the watches' free cardholders at
// their own price (€65 each, only while the watch gift runs - useGiftLines gives no watch gifts after it). The clutches' gift
// cardholders are not counted (they were never part of the cart's saving). The card -5% is not in it (checkout shows it apart).
export function cartSavingsEur(items: CartItem[], giftLines: GiftLine[], setsDiscount: number, promoDiscount: number): number {
  const sale = items.reduce(
    (s, { product, quantity }) => s + (isOnSale(product) ? ((product.originalPrice as number) - product.price) * quantity : 0),
    0,
  );
  const watchGifts = giftLines
    .filter((g) => getProductBySlug(g.clutchSlug)?.category === "watches")
    .reduce((s, g) => s + (getProductBySlug(g.giftSlug)?.price ?? 0) * g.qty, 0);
  return Math.round((sale + setsDiscount + promoDiscount + watchGifts) * 100) / 100;
}
