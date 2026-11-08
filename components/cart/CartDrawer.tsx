"use client";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { useGiftLines } from "@/lib/use-gifts";
import { CheckoutForm } from "./CheckoutForm";
import { CartCrossSell } from "./CartCrossSell";
import { CartGiftRow } from "./GiftRow";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { promoBase, opoLines } from "@/lib/bundles";
import { opoExcludedFromPromo, opoFreeUnits } from "@/lib/one-plus-one";
import { DrawerTop, ReserveLine, ShipProgress, LineItem, SumRow, TotalRow, TrustRow } from "./drawer-ui";
import { isOnSale } from "@/lib/price";
import { cardDiscountEur } from "@/lib/card-discount";
import { CollectionOddModal, ODD_MODAL_BG } from "./CollectionOddModal";
import { collectionFreeRanking, collectionUnits, pieceLive } from "@/lib/new-collection";
import { opoGroupOf } from "@/lib/one-plus-one";
import { getProductBySlug } from "@/lib/products";
import { useLeatherStock } from "@/lib/use-gifts";
import { useCountry } from "@/lib/country";
import { displayPrice } from "@/lib/price";

// Same text as lib/promo.ts PROMO_NOT_ON_SALE (not imported: that module pulls the Supabase client into the browser bundle).
const PROMO_NOT_ON_SALE = "Кодът не важи за продукти на намаление";

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
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoRate, setPromoRate] = useState(0.10); // fraction from the validated code - 10% newsletter, 5% waitlist apology
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  // The code field is folded behind a small "Имам промо код" link; a tap opens it (and focuses the input).
  const [promoOpen, setPromoOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Free gift cardholders for the clutches in the cart - display only, never cart items, so
  // they stay out of the subtotal, the free-shipping threshold and every discount.
  const giftLines = useGiftLines(items);
  const subtotal = totalPrice();
  const { totalDiscount } = bundleDiscount();
  const afterBundles = subtotal - totalDiscount;
  // No stacking: the promo code applies to full-price items only (after their set
  // discounts) - sale items are excluded. The server re-derives the same number.
  const promoDiscount = promoApplied ? parseFloat((promoBase(items, totalDiscount) * promoRate).toFixed(2)) : 0;
  const hasSaleItems = items.some((i) => isOnSale(i.product));
  // "Спестявате": every crossed-out price minus the current one, over the whole cart (sale items only; sets and promo are separate lines).
  const savings = Math.round(
    items.reduce((s, { product, quantity }) => s + (isOnSale(product) ? ((product.originalPrice as number) - product.price) * quantity : 0), 0) * 100,
  ) / 100;
  const total = afterBundles - promoDiscount;
  // "С карта": the same 5% (max €25) the checkout takes off for a card payment (lib/card-discount.ts); none with a promo code.
  const cardSaving = CARD_PAYMENTS_ENABLED ? cardDiscountEur(total, promoDiscount) : 0;
  const count = totalItems();
  // The redesigned cart step (owner, 08.11.2026): one red "Отстъпка" = every saving together (sale prices, sets incl. 1+1, promo).
  const allSavings = Math.round((savings + totalDiscount + promoDiscount) * 100) / 100;
  const freeUnits = opoFreeUnits(opoLines(items));
  const eur = (n: number) => `€${Number.isInteger(Math.round(n * 100) / 100) ? Math.round(n) : n.toFixed(2).replace(".", ",")}`;
  const freeShippingThreshold = 60;
  // Free-shipping qualification is checked on the pre-promo amount (after bundle,
  // before promo code) so a discount code never turns free shipping into paid.
  const shippingQualifyingAmount = afterBundles;

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { valid: boolean; discount?: number; error?: string };
      if (data.valid && promoBase(items, totalDiscount) <= 0) {
        // Only discounted products in the cart: the code covers none of them (the server refuses it the same way).
        // Items of a 1+1 group (lib/one-plus-one.ts) never take a code either: the 1+1 is their promotion.
        setPromoError(items.some((i) => opoExcludedFromPromo(i.product.slug)) && !items.some((i) => isOnSale(i.product)) ? "Кодът не важи за продукти с оферта 1+1" : PROMO_NOT_ON_SALE);
      } else if (data.valid) {
        setPromoInput(code);
        setPromoRate(typeof data.discount === "number" ? data.discount : 0.10);
        setPromoApplied(true);
      } else {
        setPromoError(data.error || "Невалиден промо код");
      }
    } catch {
      setPromoError("Грешка при проверката. Опитайте отново.");
    } finally {
      setPromoLoading(false);
    }
  };
  const remaining = Math.max(0, freeShippingThreshold - shippingQualifyingAmount);
  const progress = Math.min(1, shippingQualifyingAmount / freeShippingThreshold);
  const reached = remaining === 0 && items.length > 0;

  // ── Cart countdown timer ────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(CART_TIMEOUT);
  const [timerStarted, setTimerStarted] = useState(false);

  useEffect(() => {
    if (items.length > 0 && !timerStarted) {
      setTimeLeft(CART_TIMEOUT);
      setTimerStarted(true);
    }
    if (items.length === 0) {
      setTimerStarted(false);
      setTimeLeft(CART_TIMEOUT);
    }
  }, [items.length, timerStarted]);

  useEffect(() => {
    if (!timerStarted) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timerStarted]);

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
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] ${showCheckout ? "bg-charcoal-deep" : "bg-white"} z-[80] flex flex-col shadow-2xl transition-transform duration-400 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Количка"
      >
        {/* Header - checkout step: same dark theme, with the way back to the cart in it */}
        {showCheckout ? (
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-2 min-h-[44px] -my-2 pr-3 font-sans text-sm font-medium text-[#C9C9C9] transition-colors hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Количка
            </button>
            <h2 className="font-serif text-xl text-white">Поръчка</h2>
            <button onClick={closeCart} aria-label="Затвори" className="flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-3 text-2xl leading-none text-[#A0A0A0] transition-colors hover:text-white">×</button>
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


        {/* Countdown timer in the checkout step (owner decision, 2026-10-15): the same running countdown as in the cart, as a slim
            dark bar with yellow text right under the header - always visible, and never over the order summary. */}
        {items.length > 0 && showCheckout && (
          <div className={`flex items-center gap-2.5 border-b border-white/8 px-5 py-2.5 ${timeLeft === 0 ? "bg-red-950/30" : "bg-amber-950/20"}`}>
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={timeLeft === 0 ? "#FCA5A5" : "#FCD34D"}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className="flex-shrink-0"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {timeLeft > 0 ? (
              <p className="font-sans text-[13px] font-normal leading-snug text-[#FDE68A]">
                Вашата количка ще се пази още{" "}
                <span className="font-bold text-[#FCD34D]">{timerMM}:{timerSS}</span>{" "}
                минути.
              </p>
            ) : (
              <p className="font-sans text-[13px] font-normal leading-snug text-[#FCA5A5]">
                Времето за резервация изтече.
              </p>
            )}
          </div>
        )}


        {showCheckout ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <CheckoutForm
              items={items}
              total={total}
              promoCode={promoApplied ? promoInput : undefined}
              promoDiscount={promoDiscount}
              promoRate={promoRate}
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

            {/* Footer: promo link, summary, button, 3 icons */}
            <div className="px-5 sm:px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-border bg-white">
              <div className="mb-2.5">
                {!promoApplied && !promoOpen ? (
                  <button
                    type="button"
                    data-testid="promo-toggle"
                    onClick={() => setPromoOpen(true)}
                    className="font-sans text-[12px] text-ink-muted underline underline-offset-2 hover:text-navy transition-colors py-1"
                  >
                    Имам промо код
                  </button>
                ) : !promoApplied ? (
                  <div>
                    <div className="flex border border-border">
                      <input
                        type="text"
                        autoFocus
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                        placeholder="Промо код"
                        className="flex-1 min-w-0 bg-white text-navy font-sans text-base tracking-wider uppercase px-3 py-2 focus:outline-none placeholder:text-ink-faint placeholder:normal-case placeholder:tracking-normal"
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={promoLoading}
                        className="font-sans text-[11px] tracking-widest uppercase text-navy hover:bg-navy/5 px-4 border-l border-border transition-colors disabled:opacity-50"
                      >
                        {promoLoading ? "..." : "Приложи"}
                      </button>
                    </div>
                    {promoError && <p className="font-sans text-[12px] text-[#B42318] mt-1.5">{promoError}</p>}
                  </div>
                ) : (
                  <div data-testid="promo-applied">
                    <p className="font-sans text-[12px] text-[#2F6B3B]">✓ Промо код {promoInput} приложен (−{Math.round(promoRate * 100)}%)</p>
                    {hasSaleItems && <p className="font-sans text-[11px] text-ink-muted mt-0.5">{PROMO_NOT_ON_SALE}</p>}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {allSavings > 0 && <SumRow label="Отстъпка" value={`−${eur(allSavings)}`} tone="discount" testId="drawer-discount" />}
                <SumRow label="Доставка" value={reached ? "Безплатна" : "Изчислява се"} tone={reached ? "free" : undefined} testId="drawer-shipping" />
                <TotalRow label="Общо" value={eur(total)} />
                {cardSaving > 0 && (
                  <p data-testid="drawer-card-total" className="text-right font-sans text-[12px] text-ink-muted">
                    С карта: {eur(total - cardSaving)} (спестявате {eur(cardSaving)})
                  </p>
                )}
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
