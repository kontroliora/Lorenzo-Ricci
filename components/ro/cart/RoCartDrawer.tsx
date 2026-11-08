"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRoCart } from "@/lib/ro/store";
import { roAmounts } from "@/lib/ro/pricing";
import { RO_FREE_SHIPPING_RON, fmtRON } from "@/lib/ro/config";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { RoCheckoutForm } from "./RoCheckoutForm";
import { bundleLineLabel } from "./shared";
import { opoLineId } from "@/lib/one-plus-one";
import { RoCartCrossSell } from "./RoCartCrossSell";
import { CollectionOddModal, ODD_MODAL_RO } from "@/components/cart/CollectionOddModal";
import { collectionFreeRanking, collectionUnits, pieceLive } from "@/lib/new-collection";
import { opoGroupOf } from "@/lib/one-plus-one";
import { getProductBySlug } from "@/lib/products";
import { localizeProduct, RO_SLUGS } from "@/lib/ro/catalog";
import { ronOf } from "@/lib/ro/config";
import { useLeatherStock } from "@/lib/use-gifts";
import { roCartLine } from "@/components/ro/product/cart-line";

// Romania cart drawer (port of components/cart/CartDrawer.tsx): lei, card payment only (no ramburs), sets with their discount,
// crossed-out sale prices, free delivery from RO_FREE_SHIPPING_RON (judged on the amount after set discounts). A cart holding a
// product that needs advance payment (EUR 1500 and up) has no order button: the checkout shows the contact flow instead.
// Deliberately without gifts, promo codes, cross-sell and the reservation countdown.
export function RoCartDrawer() {
  const isOpen = useRoCart((s) => s.isOpen);
  const items = useRoCart((s) => s.items);
  const close = useRoCart((s) => s.close);
  const setQuantity = useRoCart((s) => s.setQuantity);
  const removeItem = useRoCart((s) => s.removeItem);
  const [showCheckout, setShowCheckout] = useState(false);
  // Women's collection 1+1: an odd number of collection pieces = one more is free; "Comandă" first offers it (CollectionOddModal).
  const addItem = useRoCart((s) => s.addItem);
  const [oddOpen, setOddOpen] = useState(false);
  const liveStock = useLeatherStock(isOpen);
  const drawerRef = useRef<HTMLDivElement>(null);

  // All money through lib/ro/pricing.ts roAmounts (the server uses the same function). `goods` is after set discounts and is
  // what delivery is judged on.
  const { subtotal, goods, shipping: shippingCost, total, bundles } = roAmounts(items);
  const needsPrepayment = items.some((i) => i.prepay);
  // "Economisiți": every crossed-out price minus the current one, over the whole cart.
  const savings = items.reduce((s, i) => s + (i.originalRon != null && i.originalRon > i.ron ? (i.originalRon - i.ron) * i.quantity : 0), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const remaining = Math.max(0, RO_FREE_SHIPPING_RON - goods);
  const progress = Math.min(1, goods / RO_FREE_SHIPPING_RON);
  const reached = remaining === 0 && items.length > 0;

  useEffect(() => {
    if (!isOpen) { setShowCheckout(false); setOddOpen(false); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Move keyboard focus into the drawer when it opens.
  useEffect(() => {
    if (isOpen) drawerRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  const collectionLines = items.map((i) => ({ slug: i.slug, quantity: i.quantity }));
  const oddCollection = collectionUnits(collectionLines) % 2 === 1 && !!opoGroupOf(collectionLines.find((l) => collectionUnits([l]) > 0)?.slug);
  const oddSuggestions = oddCollection
    ? collectionFreeRanking(
        items.map((i) => i.slug),
        (slug) => { const p = getProductBySlug(slug); return !!p && p.inStock && pieceLive(slug) && RO_SLUGS.includes(slug) && (liveStock?.[slug] ?? p.stock ?? 1) > 0; },
        new Set(items.map((i) => i.slug)),
      ).slice(0, 4).flatMap((slug) => {
        const raw = getProductBySlug(slug);
        if (!raw) return [];
        const p = localizeProduct(raw);
        return [{ slug, name: p.name, image: p.coverImage, priceText: fmtRON(ronOf(p)) }];
      })
    : [];
  const addFree = (slug: string) => {
    const raw = getProductBySlug(slug);
    if (raw) addItem(roCartLine(localizeProduct(raw), liveStock?.[slug]));
    goCheckout();
  };
  const startCheckout = () => (oddSuggestions.length > 0 ? setOddOpen(true) : goCheckout());
  const goCheckout = () => {
    setOddOpen(false);
    setShowCheckout(true);
    const now = useRoCart.getState().items; // includes a free piece just added from the modal
    trackWithCapi("InitiateCheckout", {
      content_ids:      now.map((i) => i.sku),
      content_category: "RO",
      num_items:        now.reduce((s, i) => s + i.quantity, 0),
      // InitiateCheckout = the value of the goods in the cart (like AddToCart and the Bulgarian InitiateCheckout): delivery is not in it.
      // Purchase keeps the full amount (goods + delivery) on the success page.
      value:            goods,
      currency:         "RON",
    }, genEventId("IC"));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-charcoal/60 backdrop-blur-xs z-[70] transition-opacity duration-400 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-charcoal-deep z-[80] flex flex-col shadow-2xl outline-none transition-transform duration-400 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Coș de cumpărături"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {/* Header - checkout step: same dark theme, with the way back to the cart in it */}
        {showCheckout ? (
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-2 min-h-[44px] -my-2 pr-3 font-sans text-sm font-medium text-[#C9C9C9] transition-colors hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Coș
            </button>
            <h2 className="font-serif text-xl text-white">Comandă</h2>
            <button onClick={close} aria-label="Închide" className="flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-3 text-2xl leading-none text-[#A0A0A0] transition-colors hover:text-white">×</button>
          </div>
        ) : (
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="font-serif text-xl text-white">Coș de cumpărături</h2>
            {count > 0 && (
              <p className="font-sans text-xs text-white/40 mt-0.5">
                {count} {count === 1 ? "produs" : "produse"}
              </p>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Închide"
            className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>
        )}

        {/* Free delivery progress */}
        {items.length > 0 && !showCheckout && (
          <FreeShippingRing progress={progress} remaining={remaining} reached={reached} />
        )}

        {showCheckout ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <RoCheckoutForm items={items} />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="text-5xl text-white/20" aria-hidden="true">◻</div>
            <p className="font-serif text-xl text-white/50">Coșul este gol</p>
            <p className="font-sans text-xs text-white/30 tracking-wide text-center">
              Adăugați produse pentru a continua
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
              <Link href="/ro/ceasuri" onClick={close} className="btn-outline-light">
                Ceasuri
              </Link>
              <Link href="/ro/piele-de-crocodil" onClick={close} className="btn-outline-light">
                Piele de crocodil
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {items.map((item) => {
                const atStockLimit = item.stock != null && item.quantity >= item.stock;
                return (
                  <div key={item.slug} className="flex gap-4 pb-4 border-b border-white/8 last:border-0">
                    <div className="relative w-20 h-24 flex-shrink-0 bg-white/5 overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.imageAlt}
                        fill
                        quality={70}
                        sizes="80px"
                        className="object-cover object-center"
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-serif text-base text-white leading-tight">{item.name}</h4>
                        {atStockLimit && (
                          <p className="font-sans text-[11px] text-white/40 mt-0.5 tracking-wide">
                            Stoc disponibil: {item.stock} buc.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0 border border-white/10">
                          <button
                            onClick={() => setQuantity(item.slug, item.quantity - 1)}
                            aria-label={`Scade cantitatea pentru ${item.name}`}
                            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors text-lg"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-sans text-xs text-white" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(item.slug, item.quantity + 1)}
                            disabled={atStockLimit}
                            aria-label={`Crește cantitatea pentru ${item.name}`}
                            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors text-lg disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {item.originalRon != null && item.originalRon > item.ron && (
                              <span className="font-sans text-[11px] text-white/30 line-through block">
                                {fmtRON(item.originalRon * item.quantity)}
                              </span>
                            )}
                            <span className="font-serif text-base text-white block">
                              {fmtRON(item.ron * item.quantity)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeItem(item.slug)}
                            aria-label={`Elimină ${item.name} din coș`}
                            className="text-white/25 hover:text-white transition-colors text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <RoCartCrossSell />
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-white/8">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs text-white/40 tracking-wide">Subtotal</span>
                <span className="font-serif text-base text-white">{fmtRON(subtotal)}</span>
              </div>

              {/* Set discount lines */}
              {bundles.map(({ id, label, discount }) => (
                <div key={id} className="flex items-center justify-between mb-2">
                  <span className="font-sans text-xs text-green-400 tracking-wide">◈ {bundleLineLabel(label, id)}</span>
                  <span className="font-sans text-xs text-green-400 tracking-wide">-{fmtRON(discount)}</span>
                </div>
              ))}
              {/* The new collection's 1+1: each piece ships in its own velvet box */}
              {bundles.some((b) => b.id === opoLineId("jewellery")) && (
                <p data-testid="cart-box-line" className="-mt-1 mb-2 font-sans text-[11px] text-white/50 tracking-wide">Fiecare bijuterie în propria cutie din catifea</p>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs text-white/40 tracking-wide">Livrare</span>
                {shippingCost === 0 ? (
                  <span className="font-sans text-xs text-white tracking-wide">GRATUITĂ</span>
                ) : (
                  <span className="font-sans text-xs text-white/70 tracking-wide">{fmtRON(shippingCost)}</span>
                )}
              </div>

              <div className="mb-4 pt-2 border-t border-white/8">
                {/* Only when there is a discount: how much the crossed-out prices save, in the site's accent colour */}
                {savings > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-sans text-xs text-[#D4AF37] tracking-wide">Economisiți</span>
                    <span className="font-sans text-xs font-medium text-[#D4AF37] tracking-wide">-{fmtRON(savings)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-sans text-xs font-medium text-white tracking-wide">Total</span>
                  <span className="font-serif text-lg text-white">{fmtRON(total)}</span>
                </div>
              </div>

              <button data-testid="drawer-checkout" onClick={startCheckout} className="btn-primary w-full text-center justify-center">
                {needsPrepayment ? "Continuă comanda - plată în avans" : "Comandă acum"}
              </button>

              <p className="text-center font-sans text-[13px] leading-snug text-[#C9C9C9] mt-3">
                {needsPrepayment ? "Plata în avans, stabilită direct cu noi" : "Plata cu cardul, online · Livrare cu Speedy"}
              </p>
            </div>
          </>
        )}
      </div>
      {oddOpen && oddSuggestions.length > 0 && (
        <CollectionOddModal suggestions={oddSuggestions} text={ODD_MODAL_RO} onAdd={addFree} onContinue={goCheckout} onClose={() => setOddOpen(false)} />
      )}
    </>
  );
}

// ─── Free delivery ring ──────────────────────────────────────────────────────
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
        <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden="true">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            Ați ajuns la suma pentru livrare gratuită!
          </p>
        ) : (
          <p className="font-sans text-[11px] text-white/60 tracking-wide leading-snug">
            Mai adăugați{" "}
            <span className="text-white font-medium">{fmtRON(remaining)}</span>{" "}
            pentru livrare gratuită
          </p>
        )}
      </div>
    </div>
  );
}
