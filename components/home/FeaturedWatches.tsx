"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { getWatches } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";
import { useReveal } from "@/lib/useReveal";

export function FeaturedWatches() {
  const watches = getWatches();
  const gridRef = useReveal();
  const n = watches.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [teleporting, setTeleporting] = useState<number | null>(null);
  const [isNight, setIsNight] = useState(false);
  const touchStartX = useRef(0);

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
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) goNext();
    else if (diff < -40) goPrev();
  };

  const active = watches[activeIndex];

  return (
    <section className="py-20 sm:py-40 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="section-tag mb-4">Колекция Часовници</p>
          <h2 className="section-title mb-4">Избери Своя Стил</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-lg mx-auto mt-6 leading-relaxed tracking-wide">
            Сапфирен кристал · Японски механизъм · 5 ATM водоустойчивост
          </p>
        </div>

        {/* ── Desktop grid — unchanged ─────────────────────────────────────── */}
        <div ref={gridRef} className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {watches.map((watch, i) => (
            <div key={watch.id} className={`reveal reveal-delay-${i + 1}`}>
              <ProductCard product={watch} priority={i < 2} />
            </div>
          ))}
        </div>

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
          {/* Image strip — 64vw tall to hold the 1.1× center card */}
          <div className="relative" style={{ height: "64vw" }}>
            {watches.map((watch, i) => {
              const pos        = getPos(i);
              const isActive   = pos === 0;
              const isTeleport = teleporting === i;
              const nightImg   = watch.images[1] ?? watch.coverImage;

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
                    {/* Day / Night toggle — visible only on active card */}
                    {isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsNight((v) => !v); }}
                        aria-label={isNight ? "Дневна снимка" : "Нощна снимка"}
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
            <p className="font-serif text-lg text-navy mb-5">
              {active.currency}{active.price.toFixed(2)}
            </p>
            <Link href={`/products/${active.slug}`} className="btn-primary">
              Виж Детайли
            </Link>
          </div>

          {/* Navigation — arrows + dots (no disabled state — infinite loop) */}
          <div className="flex items-center justify-center gap-5 mt-6">
            <button
              onClick={goPrev}
              aria-label="Предишен"
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
                  aria-label={`Часовник ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-5 bg-navy" : "w-1.5 bg-navy/25"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={goNext}
              aria-label="Следващ"
              className="w-8 h-8 rounded-full border border-navy/40 flex items-center justify-center text-navy text-xl leading-none transition-all active:scale-90"
            >
              ›
            </button>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-10 sm:mt-16 border-y border-border py-6 sm:py-8">
          <div className="grid grid-cols-3 gap-0 text-center divide-x divide-border">
            {[
              { label: "Безплатна доставка", sub: "За поръчки над €80" },
              { label: "2 Години Гаранция",  sub: "На всеки механизъм" },
              { label: "Преглед преди плащане", sub: "Наложен платеж" },
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
