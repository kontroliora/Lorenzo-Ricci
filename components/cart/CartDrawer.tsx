"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { CheckoutForm } from "./CheckoutForm";

export function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, totalPrice, totalItems, bundleDiscount } =
    useCartStore();
  const [showCheckout, setShowCheckout] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const subtotal = totalPrice();
  const { totalDiscount, active: activeBundles } = bundleDiscount();
  const total = subtotal - totalDiscount;
  const count = totalItems();
  const freeShippingThreshold = 80;
  const remaining = Math.max(0, freeShippingThreshold - total);
  const progress = Math.min(1, total / freeShippingThreshold);
  const reached = remaining === 0 && items.length > 0;


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

        {items.length === 0 ? (
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
        ) : showCheckout ? (
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
              onSuccess={() => {
                closeCart();
                setShowCheckout(false);
              }}
            />
          </div>
        ) : (
          <>
            {/* Items */}
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
                        <span className="font-serif text-base text-white">
                          {product.currency}{(product.price * quantity).toFixed(2)}
                        </span>
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

              {total >= freeShippingThreshold ? (
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

              {totalDiscount > 0 && (
                <div className="flex items-center justify-between mb-4 pt-2 border-t border-white/8">
                  <span className="font-sans text-xs font-medium text-white tracking-wide">Общо</span>
                  <span className="font-serif text-lg text-white">€{total.toFixed(2)}</span>
                </div>
              )}

              <button
                onClick={() => setShowCheckout(true)}
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
            Достигнахте безплатна доставка!
          </p>
        ) : (
          <p className="font-sans text-[11px] text-white/60 tracking-wide leading-snug">
            Остават{" "}
            <span className="text-white font-medium">€{remaining.toFixed(2)}</span>{" "}
            до безплатна доставка
          </p>
        )}
      </div>
    </div>
  );
}
