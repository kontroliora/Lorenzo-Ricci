"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCartStore, CART_RESERVATION_MS } from "@/lib/store";
import { useGiftLines } from "@/lib/use-gifts";
import { CheckoutForm } from "./CheckoutForm";
import { CartCrossSell } from "./CartCrossSell";
import { CartGiftRow } from "./GiftRow";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { opoLines } from "@/lib/bundles";
import { opoFreeUnits } from "@/lib/one-plus-one";
import { DrawerTop, ReserveLine, ShipProgress, LineItem, SumRow, TotalRow, TrustRow } from "./drawer-ui";
import { isOnSale } from "@/lib/price";
import { CollectionOddModal, ODD_MODAL_BG } from "./CollectionOddModal";
import { collectionFreeRanking, collectionUnits, pieceLive } from "@/lib/new-collection";
import { opoGroupOf } from "@/lib/one-plus-one";
import { getProductBySlug } from "@/lib/products";
import { useLeatherStock } from "@/lib/use-gifts";
import { useCountry } from "@/lib/country";
import { displayPrice } from "@/lib/price";


const CART_TIMEOUT = 15 * 60; // 900 seconds

export function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, totalPrice, totalItems, bundleDiscount,
    pendingCheckout, clearPendingCheckout, addItem } =
    useCartStore();
  const [showCheckout, setShowCheckout] = useState(false);
  // Women's collection 1+1: an odd number of collection pieces = one more is free; "Поръчай сега" first offers it (CollectionOddModal).
  const [oddOpen, setOddOpen] = useState(false);
  const liveStock = useLeatherStock(isOpen);
  const country = useCountry();
  const drawerRef = useRef<HTMLDivElement>(null);
  // Free gift cardholders for the clutches in the cart - display only, never cart items, so
  // they stay out of the subtotal, the free-shipping threshold and every discount.
  const giftLines = useGiftLines(items);
  const subtotal = totalPrice();
  const { totalDiscount } = bundleDiscount();
  const afterBundles = subtotal - totalDiscount;
  // Promo codes are switched off (owner, 08.11.2026 - lib/promo.ts PROMO_CODES_ENABLED): no field, no promo discount.
  const promoDiscount = 0;
  // "Спестявате": every crossed-out price minus the current one, over the whole cart (sale items only; sets and promo are separate lines).
  const savings = Math.round(
    items.reduce((s, { product, quantity }) => s + (isOnSale(product) ? ((product.originalPrice as number) - product.price) * quantity : 0), 0) * 100,
  ) / 100;
  const total = afterBundles - promoDiscount;
  // The card saving is shown only in the checkout, on the card payment option (owner, 08.11.2026).
  const count = totalItems();
  // The redesigned cart step (owner, 08.11.2026): one red "Спестявате" = every saving together (sale prices, sets incl. 1+1, promo).
  const allSavings = Math.round((savings + totalDiscount + promoDiscount) * 100) / 100;
  const freeUnits = opoFreeUnits(opoLines(items));
  const eur = (n: number) => `€${Number.isInteger(Math.round(n * 100) / 100) ? Math.round(n) : n.toFixed(2).replace(".", ",")}`;
  const freeShippingThreshold = 60;
  // Free-shipping qualification is checked on the pre-promo amount (after bundle,
  // before promo code) so a discount code never turns free shipping into paid.
  const shippingQualifyingAmount = afterBundles;

  const remaining = Math.max(0, freeShippingThreshold - shippingQualifyingAmount);
  const progress = Math.min(1, shippingQualifyingAmount / freeShippingThreshold);
  const reached = remaining === 0 && items.length > 0;

  // ── Cart countdown timer ────────────────────────────────────────────────────
  // The reservation countdown runs from the saved start (lib/store.ts reservedAt), so a reload or a reopened tab continues it
  // instead of starting again at 15:00.
  const reservedAt = useCartStore((s) => s.reservedAt);
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!reservedAt) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reservedAt]);
  const timeLeft = reservedAt ? Math.max(0, Math.ceil((CART_RESERVATION_MS - (nowTs - reservedAt)) / 1000)) : CART_TIMEOUT;

  const timerMM = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const timerSS = String(timeLeft % 60).padStart(2, "0");
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) { setShowCheckout(false); setOddOpen(false); }
  }, [isOpen]);

  const goCheckout = () => {
    setOddOpen(false);
    setShowCheckout(true);
    const now = useCartStore.getState().items; // includes a free piece just added from the modal
    trackWithCapi("InitiateCheckout", {
      content_ids: now.map((i) => i.product.sku),
      num_items:   now.reduce((s, i) => s + i.quantity, 0),
      value:       total,
      currency:    "EUR",
    }, genEventId("IC"));
  };
  const collectionLines = items.map((i) => ({ slug: i.product.slug, quantity: i.quantity }));
  const oddCollection = collectionUnits(collectionLines) % 2 === 1 && !!opoGroupOf(collectionLines.find((l) => collectionUnits([l]) > 0)?.slug);
  const oddSuggestions = oddCollection
    ? collectionFreeRanking(
        items.map((i) => i.product.slug),
        (slug) => { const p = getProductBySlug(slug); return !!p && p.inStock && pieceLive(slug) && (liveStock?.[slug] ?? p.stock ?? 1) > 0; },
        new Set(items.map((i) => i.product.slug)),
      ).slice(0, 4).flatMap((slug) => {
        const p = getProductBySlug(slug);
        return p ? [{ slug, name: p.name, image: p.coverImage, priceText: displayPrice(p, country).text }] : [];
      })
    : [];
  const addFree = (slug: string) => {
    const p = getProductBySlug(slug);
    if (p) addItem({ ...p, stock: liveStock?.[slug] ?? p.stock });
    goCheckout();
  };

  // Recovery link landed → jump straight to the checkout step.
  useEffect(() => {
    if (pendingCheckout && items.length > 0) {
      setShowCheckout(true);
      clearPendingCheckout();
    }
  }, [pendingCheckout, items.length, clearPendingCheckout]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [closeCart]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-[70] transition-opacity duration-400 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white z-[80] flex flex-col shadow-2xl transition-transform duration-400 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Количка"
      >
        {/* Header - checkout step: same light style as the cart, with the way back to the cart in it */}
        {showCheckout ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-2 min-h-[44px] -my-2 pr-3 font-sans text-sm font-medium text-navy/70 transition-colors hover:text-navy"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Количка
            </button>
            <h2 className="font-serif text-[20px] text-navy">Поръчка</h2>
            <button onClick={closeCart} aria-label="Затвори" className="flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-3 text-2xl leading-none text-navy/60 transition-colors hover:text-navy">×</button>
          </div>
        ) : (
        <>
          <DrawerTop title={count > 0 ? `Количка · ${count} ${count === 1 ? "продукт" : "продукта"}` : "Количка"} onClose={closeCart} closeLabel="Затвори" />
          {items.length > 0 ? (
            <ReserveLine expired={timeLeft === 0}>
              {timeLeft > 0 ? <>Резервирано за <span className="font-semibold text-navy tabular-nums">{timerMM}:{timerSS}</span></> : "Времето за резервация изтече."}
            </ReserveLine>
          ) : <div className="border-b border-border" />}
        </>
        )}

        {/* Free delivery: progress only while below the threshold (nothing once it is reached) */}
        {items.length > 0 && !showCheckout && !reached && (
          <ShipProgress progress={progress}>
            Добавете още <span className="font-semibold text-navy">{eur(remaining)}</span> за безплатна доставка
          </ShipProgress>
        )}


        {/* Countdown in the checkout step: the same one thin line as in the cart */}
        {items.length > 0 && showCheckout && (
          <div className="pt-3">
            <ReserveLine expired={timeLeft === 0}>
              {timeLeft > 0 ? <>Резервирано за <span className="font-semibold text-navy tabular-nums">{timerMM}:{timerSS}</span></> : "Времето за резервация изтече."}
            </ReserveLine>
          </div>
        )}

        {showCheckout ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <CheckoutForm
              items={items}
              total={total}
              onSuccess={() => {
                closeCart();
                setShowCheckout(false);
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <div data-testid="drawer-empty" className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-serif text-[22px] text-navy">Количката е празна</p>
            <p className="font-sans text-[13px] text-ink-muted">Добавете продукти, за да продължите</p>
            <button onClick={closeCart} className="btn-outline mt-3">Продължи пазаруването</button>
          </div>
        ) : (
          <>
            {/* Items + the 1+1 upsell / cross-sell */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
              {items.map(({ product, quantity }, idx) => {
                const gift = giftLines.find((g) => g.clutchSlug === product.slug);
                const free = freeUnits[idx] ?? 0;   // units the 1+1 makes free: "€109" struck + "Безплатно" (display only)
                const paid = quantity - free;
                return (
                  <Fragment key={product.id}>
                    <LineItem
                      image={product.coverImage}
                      name={product.name}
                      quantity={quantity}
                      canInc={!(product.stock != null && quantity >= product.stock)}
                      onDec={() => updateQuantity(product.id, quantity - 1)}
                      onInc={() => updateQuantity(product.id, quantity + 1)}
                      onRemove={() => removeItem(product.id)}
                      priceText={paid > 0 ? eur(product.price * paid) : null}
                      originalText={paid > 0 && isOnSale(product) ? eur((product.originalPrice as number) * paid) : null}
                      free={free > 0 ? { count: free, unitText: eur(product.price) } : null}
                      freeText="Безплатно"
                      labels={{ dec: "Намали количеството", inc: "Увеличи количеството", remove: "Премахни" }}
                    />
                    {gift && <CartGiftRow gift={gift} />}
                  </Fragment>
                );
              })}
              <CartCrossSell />
            </div>

            {/* Footer: summary, button, 3 icons */}
            <div className="px-5 sm:px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-border bg-white">
              <div className="flex flex-col gap-1.5">
                {allSavings > 0 && <SumRow label="Спестявате" value={`−${eur(allSavings)}`} tone="discount" testId="drawer-discount" />}
                <SumRow label="Доставка" value={reached ? "Безплатна" : "Изчислява се"} tone={reached ? "free" : undefined} testId="drawer-shipping" />
                <TotalRow label="Общо" value={eur(total)} />
              </div>

              <button
                data-testid="drawer-checkout"
                onClick={() => (oddSuggestions.length > 0 ? setOddOpen(true) : goCheckout())}
                className="btn-primary w-full mt-4 py-4 text-[12px] font-semibold"
              >
                Продължи към плащане
              </button>
              <TrustRow items={[
                { icon: "cash", label: "Наложен платеж" },
                { icon: "truck", label: "Доставка с Еконт" },
                { icon: "eye", label: "Преглед преди плащане" },
              ]} />
            </div>
          </>
        )}
      </div>
      {oddOpen && oddSuggestions.length > 0 && (
        <CollectionOddModal suggestions={oddSuggestions} text={ODD_MODAL_BG} onAdd={addFree} onContinue={goCheckout} onClose={() => setOddOpen(false)} />
      )}
    </>
  );
}
