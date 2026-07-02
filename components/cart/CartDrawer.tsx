"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { CheckoutForm } from "./CheckoutForm";
import { CartCrossSell } from "./CartCrossSell";
import { trackWithCapi, genEventId } from "@/lib/fbq";

const CART_TIMEOUT = 15 * 60; // 900 seconds

export function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, totalPrice, totalItems, bundleDiscount } =
    useCartStore();
  const [showCheckout, setShowCheckout] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const subtotal = totalPrice();
  const { totalDiscount, active: activeBundles } = bundleDiscount();
  const afterBundles = subtotal - totalDiscount;
  const itemSavings = items.reduce((sum, { product, quantity }) =>
    sum + (product.originalPrice && product.originalPrice > product.price
      ? (product.originalPrice - product.price) * quantity : 0), 0);
  const promoDiscount = promoApplied ? parseFloat((afterBundles * 0.1).toFixed(2)) : 0;
  const total = afterBundles - promoDiscount;
  const count = totalItems();
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
      const data = await res.json() as { valid: boolean; error?: string };
      if (data.valid) {
        setPromoInput(code);
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
    if (!isOpen) setShowCheckout(false);
  }, [isOpen]);

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
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-charcoal-deep z-[80] flex flex-col shadow-2xl transition-transform duration-400 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Количка"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="font-serif text-xl text-white">Количка</h2>
            {count > 0 && (
              <p className="font-sans text-xs text-white/40 mt-0.5">
                {count} {count === 1 ? "продукт" : "продукта"}
              </p>
            )}
          </div>
          <button
            onClick={closeCart}
            aria-label="Затвори"
            className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Free shipping progress */}
        {items.length > 0 && (
          <FreeShippingRing progress={progress} remaining={remaining} reached={reached} />
        )}

        {/* Countdown timer */}
        {items.length > 0 && (
          <div className={`px-6 py-2.5 flex items-center gap-3 border-b border-white/8 transition-colors duration-500 ${timeLeft === 0 ? "bg-red-950/30" : "bg-amber-950/20"}`}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={timeLeft === 0 ? "rgba(252,165,165,0.7)" : "rgba(251,191,36,0.65)"}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className="flex-shrink-0"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {timeLeft > 0 ? (
              <p className="font-sans text-[11px] text-white/55 tracking-wide leading-snug">
                Вашата количка ще се пази още{" "}
                <span className="font-bold text-amber-300">{timerMM}:{timerSS}</span>{" "}
                минути.
              </p>
            ) : (
              <p className="font-sans text-[11px] text-red-300/80 tracking-wide leading-snug">
                Времето за резервация изтече.
              </p>
            )}
          </div>
        )}

        {showCheckout ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs tracking-widest uppercase mb-6"
            >
              ← Обратно към количката
            </button>
            <CheckoutForm
              items={items}
              total={total}
              promoCode={promoApplied ? promoInput : undefined}
              promoDiscount={promoDiscount}
              onSuccess={() => {
                closeCart();
                setShowCheckout(false);
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="text-5xl text-white/20">◻</div>
            <p className="font-serif text-xl text-white/50">Количката е празна</p>
            <p className="font-sans text-xs text-white/30 tracking-wide text-center">
              Добавете продукти, за да продължите
            </p>
            <button onClick={closeCart} className="btn-outline mt-4">
              Продължи пазаруването
            </button>
          </div>
        ) : (
          <>
            {/* Items + Cross-sell */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {items.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex gap-4 pb-4 border-b border-white/8 last:border-0"
                >
                  <div className="relative w-20 h-24 flex-shrink-0 bg-white/5 overflow-hidden">
                    <Image
                      src={product.coverImage.src}
                      alt={product.coverImage.alt}
                      fill
                      quality={70}
                      sizes="80px"
                      className="object-cover object-center"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif text-base text-white leading-tight">{product.name}</h4>
                      <p className="font-sans text-[11px] text-white/40 mt-0.5 tracking-wide">
                        {product.warranty}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0 border border-white/10">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors text-lg"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-sans text-xs text-white">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          disabled={product.stock != null && quantity >= product.stock}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors text-lg disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-serif text-base text-white block">
                            {product.currency}{(product.price * quantity).toFixed(2)}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="font-sans text-[11px] text-white/30 line-through block">
                              {product.currency}{(product.originalPrice * quantity).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(product.id)}
                          aria-label="Премахни"
                          className="text-white/25 hover:text-white transition-colors text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <CartCrossSell />
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-white/8">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs text-white/40 tracking-wide">Подсума</span>
                <span className="font-serif text-base text-white">€{subtotal.toFixed(2)}</span>
              </div>

              {/* Bundle discount lines */}
              {activeBundles.map(({ label, discount }) => (
                <div key={label} className="flex items-center justify-between mb-2">
                  <span className="font-sans text-xs text-navy-light tracking-wide">
                    ◈ {label} -10%
                  </span>
                  <span className="font-sans text-xs text-navy-light tracking-wide">
                    -€{discount.toFixed(2)}
                  </span>
                </div>
              ))}

              {/* Promo code */}
              <div className="mb-4">
                {!promoApplied ? (
                  <div>
                    <div className="flex border border-white/10">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                        placeholder="Промо код"
                        className="flex-1 bg-transparent text-white font-sans text-[11px] tracking-widest uppercase px-3 py-2.5 focus:outline-none placeholder:text-white/20 placeholder:normal-case placeholder:tracking-normal"
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={promoLoading}
                        className="font-sans text-[10px] tracking-widest uppercase bg-white/6 hover:bg-white/12 text-white/50 hover:text-white px-4 border-l border-white/10 transition-colors disabled:opacity-50"
                      >
                        {promoLoading ? "..." : "Приложи"}
                      </button>
                    </div>
                    {promoError && (
                      <p className="font-sans text-[10px] text-red-400/60 mt-1.5 tracking-wide">{promoError}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400/80 mb-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="font-sans text-[11px] tracking-wide">Промо код {promoInput} приложен</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-xs text-emerald-400/70 tracking-wide">◈ {promoInput} -10%</span>
                      <span className="font-sans text-xs text-emerald-400/70">-€{promoDiscount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {shippingQualifyingAmount >= freeShippingThreshold ? (
                <div className="flex items-center justify-between mb-4">
                  <span className="font-sans text-xs text-white/40 tracking-wide">Доставка</span>
                  <span className="font-sans text-xs text-white tracking-wide">БЕЗПЛАТНА</span>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-4">
                  <span className="font-sans text-xs text-white/40 tracking-wide">Доставка</span>
                  <span className="font-sans text-xs text-white/50 tracking-wide">Изчислява се</span>
                </div>
              )}

              {(totalDiscount > 0 || promoDiscount > 0) && (
                <div className="flex items-center justify-between mb-4 pt-2 border-t border-white/8">
                  <span className="font-sans text-xs font-medium text-white tracking-wide">Общо</span>
                  <span className="font-serif text-lg text-white">€{total.toFixed(2)}</span>
                </div>
              )}

              {itemSavings > 0 && (
                <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-sm">
                  <span className="font-sans text-[11px] text-emerald-400 tracking-wide">Спестявате от редовни цени</span>
                  <span className="font-sans text-sm text-emerald-400 font-semibold">€{itemSavings.toFixed(2)}</span>
                </div>
              )}

              <button
                onClick={() => {
                  setShowCheckout(true);
                  trackWithCapi("InitiateCheckout", {
                    content_ids: items.map((i) => i.product.sku),
                    num_items:   items.reduce((s, i) => s + i.quantity, 0),
                    value:       total,
                    currency:    "EUR",
                  }, genEventId("IC"));
                }}
                className="btn-primary w-full text-center justify-center"
              >
                Поръчай сега - Наложен платеж
              </button>

              <p className="text-center font-sans text-[10px] text-white/25 tracking-wide mt-3">
                Плащате при получаване · Преглед преди плащане
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Free Shipping Ring ──────────────────────────────────────────────────────
const RADIUS = 17;
const CIRC = 2 * Math.PI * RADIUS; // ≈ 106.8

function FreeShippingRing({
  progress,
  remaining,
  reached,
}: {
  progress: number;
  remaining: number;
  reached: boolean;
}) {
  const offset = CIRC * (1 - progress);

  return (
    <div
      className={`px-6 py-3 flex items-center gap-4 transition-colors duration-500 ${
        reached ? "bg-navy/20" : "bg-white/3"
      }`}
    >
      {/* Circular ring */}
      <div className="flex-shrink-0 relative w-10 h-10">
        <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
          {/* Track */}
          <circle
            cx="20" cy="20" r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          {/* Progress arc */}
          <circle
            cx="20" cy="20" r={RADIUS}
            fill="none"
            stroke={reached ? "#4ade80" : "rgba(255,255,255,0.55)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        {/* Icon in centre */}
        <div className="absolute inset-0 flex items-center justify-center">
          {reached ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <path d="M16 8h4l3 5v3h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          )}
        </div>
      </div>

      {/* Text */}
      <div>
        {reached ? (
          <p className="font-sans text-[11px] text-green-400 font-medium tracking-wide leading-snug">
            Достигнахте сумата за безплатна доставка!
          </p>
        ) : (
          <p className="font-sans text-[11px] text-white/60 tracking-wide leading-snug">
            Добави още{" "}
            <span className="text-white font-medium">€{remaining.toFixed(2)}</span>{" "}
            за БЕЗПЛАТНА доставка
          </p>
        )}
      </div>
    </div>
  );
}
