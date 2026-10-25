"use client";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { RoProductCard } from "@/components/ro/RoProductCard";
import { useReveal } from "@/lib/useReveal";
import { fmtRON, RO_FREE_SHIPPING_RON, RO_INSPECT_BEFORE_PAY } from "@/lib/ro/config";
import { ronOf, ronOriginalOf } from "@/lib/ro/config";
import type { Product } from "@/lib/types";

// Romanian counterpart of components/home/FeaturedWatches.tsx. The page hands in the watches already filtered
// (roEligible), price-overridden and localized, so prices here always match the listings. A watch on sale shows its
// current price and the old price crossed out (same sale as the Bulgarian site, both converted to lei).
// Yachting is the new collection: its own block on top, the earlier models below - never in the same carousel or row.
const isYachting = (p: Product) => p.slug.startsWith("yachting-");

export function RoFeaturedWatches({ watches }: { watches: Product[] }) {
  const yachting = watches.filter(isYachting);
  const classic = watches.filter((w) => !isYachting(w));

  return (
    <section className="py-20 sm:py-40 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {yachting.length > 0 && (
          <WatchGroup
            tag="Colecție nouă"
            title="Yachting"
            subtitle="Negru · Albastru · Alb"
            watches={yachting}
            priority
          />
        )}

        {classic.length > 0 && (
          <div className={yachting.length > 0 ? "mt-20 sm:mt-32 pt-20 sm:pt-32 border-t border-border" : ""}>
            <WatchGroup
              tag="Ceasuri"
              title="Colecția clasică"
              subtitle="Sticlă safir · Mecanism japonez · Rezistență la apă 5 ATM"
              watches={classic}
            />
          </div>
        )}

        {/* Trust strip */}
        <div className="mt-10 sm:mt-16 border-y border-border py-6 sm:py-8">
          <div className="grid grid-cols-3 gap-0 text-center divide-x divide-border">
            {[
              { label: "Livrare gratuită", sub: `Pentru comenzi de peste ${fmtRON(RO_FREE_SHIPPING_RON)}` },
              { label: "5 ani garanție", sub: "Comercială · pentru fiecare mecanism" },
              CARD_PAYMENTS_ENABLED
                ? { label: "Card sau ramburs", sub: "Plată online securizată" }
                : RO_INSPECT_BEFORE_PAY
                ? { label: "Verifici înainte de plată", sub: "Plata la livrare (ramburs)" }
                : { label: "Plata la livrare", sub: "Ramburs, la primirea coletului" },
            ].map(({ label, sub }) => (
              <div key={label} className="px-2 sm:px-6 py-2">
                <p className="font-sans text-[9px] sm:text-xs font-medium tracking-[0.1em] sm:tracking-[0.18em] uppercase text-charcoal mb-1">
                  {label}
                </p>
                <p className="font-sans text-[8px] sm:text-[10px] font-light text-ink-faint tracking-wide">
                  {sub}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

// One collection: heading, desktop row and its own mobile carousel.
function WatchGroup({ tag, title, subtitle, watches, priority = false }: {
  tag: string;
  title: string;
  subtitle: string;
  watches: Product[];
  priority?: boolean;
}) {
  const gridRef = useReveal();

  return (
    <div data-watch-group>
      <div className="text-center mb-10 sm:mb-16">
        <p className="section-tag mb-4">{tag}</p>
        <h2 className="section-title mb-4">{title}</h2>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-lg mx-auto mt-6 leading-relaxed tracking-wide">
          {subtitle}
        </p>
      </div>

      {/* ── Desktop grid ─────────────────────────────────────────────────── */}
      <div ref={gridRef} className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
        {watches.map((watch, i) => (
          <div key={watch.id} className={`reveal reveal-delay-${i + 1}`}>
            <RoProductCard product={watch} priority={priority && i < 2} learnMore />
          </div>
        ))}
      </div>

      <WatchCoverFlow watches={watches} />
    </div>
  );
}

function WatchCoverFlow({ watches }: { watches: Product[] }) {
  const n = watches.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [teleporting, setTeleporting] = useState<number | null>(null);
  const [isNight, setIsNight] = useState(false);
  const touchStartX = useRef(0);
  const swiped      = useRef(false);

  const leftI  = (activeIndex - 1 + n) % n;
  const rightI = (activeIndex + 1) % n;

  const getPos = (i: number): -1 | 0 | 1 => {
    if (i === activeIndex) return 0;
    if (i === leftI) return -1;
    return 1;
  };

  const goNext = () => {
    setTeleporting(leftI);
    setActiveIndex((activeIndex + 1) % n);
    setIsNight(false);
    setTimeout(() => setTeleporting(null), 50);
  };

  const goPrev = () => {
    setTeleporting(rightI);
    setActiveIndex((activeIndex - 1 + n) % n);
    setIsNight(false);
    setTimeout(() => setTeleporting(null), 50);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swiped.current = false;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) { swiped.current = true; goNext(); }
    else if (diff < -40) { swiped.current = true; goPrev(); }
  };

  const active = watches[activeIndex];
  const activeOldRon = ronOriginalOf(active);

  return (
    <>
      {/* ── Mobile Cover Flow (infinite) ────────────────────────────────── */}
      {/*
        All 3 cards share the same vertical center (top: calc(50% - 28vw) places every
        card's center at the strip's midpoint regardless of scale), so they sit on one axis.
        Center scale 1.1 makes it the clear focal point; sides at 0.55 recede into BG.
        Blur is on the <Image> not the wrapper (overflow-hidden clips it; no white halo).
        Day/Night toggle swaps images for the active watch via opacity crossfade.
        Teleport: the wrapping card gets opacity:0 + transition:none for 1 tick.
      */}
      <div
        className="sm:hidden overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Image strip - 64vw tall to hold the 1.1× center card */}
        <div className="relative" style={{ height: "64vw" }}>
          {watches.map((watch, i) => {
            const pos        = getPos(i);
            const isActive   = pos === 0;
            const isTeleport = teleporting === i;
            // The lume shot by name, not by position - galleries differ per model.
            const nightImg   = watch.images.find((im) => /lume|noshten/i.test(im.src)) ?? watch.images[1] ?? watch.coverImage;

            const xShift = pos === 0 ? "0vw" : pos === -1 ? "-35vw" : "35vw";
            const scale  = isActive ? 1.1 : 0.55;

            return (
              <div
                key={watch.id}
                className="absolute"
                style={{
                  left: "50%",
                  /* top: calc(50% − halfHeight) centers every card on the strip's midline */
                  top: "calc(50% - 28vw)",
                  width: "56vw",
                  transform: `translateX(-50%) translateX(${xShift}) scale(${scale})`,
                  /* no transformOrigin override → browser default "center center" keeps vertical axis aligned */
                  transition: isTeleport
                    ? "none"
                    : "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.38s ease",
                  opacity: isTeleport ? 0 : isActive ? 1 : 0.82,
                  zIndex: isActive ? 10 : 5,
                }}
              >
                <div className="relative aspect-square overflow-hidden">
                  {/* Day image */}
                  <Image
                    src={watch.coverImage.src}
                    alt={watch.coverImage.alt}
                    fill
                    quality={75}
                    sizes="56vw"
                    className={`object-contain transition-[opacity,filter] duration-500${!isActive ? " blur-[2px]" : ""}${isNight ? " opacity-0" : " opacity-100"}`}
                    priority={isActive}
                  />
                  {/* Night (lume) image */}
                  <Image
                    src={nightImg.src}
                    alt={nightImg.alt}
                    fill
                    quality={75}
                    sizes="56vw"
                    className={`object-contain transition-[opacity,filter] duration-500${!isActive ? " blur-[2px]" : ""}${isNight ? " opacity-100" : " opacity-0"}`}
                  />
                  {/* Tap active card to navigate to product page (won't fire if user swiped) */}
                  {isActive && (
                    <Link
                      href={`/ro/produse/${watch.slug}`}
                      className="absolute inset-0 z-20"
                      onClick={(e) => { if (swiped.current) e.preventDefault(); }}
                      aria-label={`Vedeți ${watch.name}`}
                    />
                  )}
                  {/* Day / Night toggle - visible only on active card */}
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsNight((v) => !v); }}
                      aria-label={isNight ? "Imagine de zi" : "Imagine de noapte"}
                      className="absolute top-2.5 right-2.5 z-30 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm border border-border flex items-center justify-center shadow-sm transition-colors hover:bg-white"
                    >
                      {isNight ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500">
                          <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-navy">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Tap side card to navigate toward it */}
                {!isActive && (
                  <div
                    className="absolute inset-0 z-20 cursor-pointer"
                    onClick={() => pos === -1 ? goPrev() : goNext()}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Active watch info */}
        <div className="text-center px-6 mt-5">
          <h3 className="font-serif text-xl text-charcoal mb-1">{active.name}</h3>
          <div className="flex items-baseline justify-center gap-3 mb-5">
            <span className="font-serif text-lg text-navy">
              {fmtRON(ronOf(active))}
            </span>
            {activeOldRon !== undefined && (
              <span className="font-sans text-sm text-ink-muted line-through">
                {fmtRON(activeOldRon)}
              </span>
            )}
          </div>
          <Link href={`/ro/produse/${active.slug}`} className="btn-primary">
            Vedeți detalii
          </Link>
        </div>

        {/* Navigation - arrows + dots (no disabled state - infinite loop) */}
        <div className="flex items-center justify-center gap-5 mt-6">
          <button
            onClick={goPrev}
            aria-label="Anterior"
            className="w-8 h-8 rounded-full border border-navy/40 flex items-center justify-center text-navy text-xl leading-none transition-all active:scale-90"
          >
            ‹
          </button>
          <div className="flex items-center gap-2">
            {watches.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (i === activeIndex) return;
                  if (i === rightI) goNext();
                  else goPrev();
                }}
                aria-label={`Ceasul ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-5 bg-navy" : "w-1.5 bg-navy/25"
                }`}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            aria-label="Următorul"
            className="w-8 h-8 rounded-full border border-navy/40 flex items-center justify-center text-navy text-xl leading-none transition-all active:scale-90"
          >
            ›
          </button>
        </div>
      </div>
    </>
  );
}
