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
  // Index of the card that must jump across (no transition) during a wrap
  const [teleporting, setTeleporting] = useState<number | null>(null);
  const touchStartX = useRef(0);

  const leftI  = (activeIndex - 1 + n) % n;
  const rightI = (activeIndex + 1) % n;

  const getPos = (i: number): -1 | 0 | 1 => {
    if (i === activeIndex) return 0;
    if (i === leftI) return -1;
    return 1;
  };

  const goNext = () => {
    // The current left card wraps to the right — teleport it invisibly
    setTeleporting(leftI);
    setActiveIndex((activeIndex + 1) % n);
    setTimeout(() => setTeleporting(null), 50);
  };

  const goPrev = () => {
    // The current right card wraps to the left — teleport it invisibly
    setTeleporting(rightI);
    setActiveIndex((activeIndex - 1 + n) % n);
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
          3 cards always visible: left(−32vw,scale.65), center(0,scale1), right(+32vw,scale.65).
          Blur lives on the <Image> not the wrapper — prevents the white-halo artifact
          caused by filter:blur bleeding outside a bg-white rectangle.
          bg-white removed from side containers (section bg is white, so mix-blend-multiply
          still blends correctly; no visible white box).
          Teleport: the card that wraps to the opposite side gets opacity:0 + transition:none
          for one tick so it jumps invisibly, then fades in at its new position.
        */}
        <div
          className="sm:hidden overflow-x-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image strip */}
          <div className="relative" style={{ height: "56vw" }}>
            {watches.map((watch, i) => {
              const pos        = getPos(i);
              const isActive   = pos === 0;
              const isTeleport = teleporting === i;

              const xShift = pos === 0 ? "0vw" : pos === -1 ? "-32vw" : "32vw";
              const scale  = isActive ? 1 : 0.65;

              return (
                <div
                  key={watch.id}
                  className="absolute top-0"
                  style={{
                    left: "50%",
                    width: "56vw",
                    transform: `translateX(-50%) translateX(${xShift}) scale(${scale})`,
                    transformOrigin: "top center",
                    transition: isTeleport
                      ? "none"
                      : "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.38s ease",
                    opacity: isTeleport ? 0 : isActive ? 1 : 0.82,
                    zIndex: isActive ? 10 : 5,
                  }}
                >
                  {/* No bg-white on container — blur must not leak a white box */}
                  <div className="relative aspect-square">
                    <Image
                      src={watch.coverImage.src}
                      alt={watch.coverImage.alt}
                      fill
                      quality={75}
                      sizes="56vw"
                      className={`object-contain mix-blend-multiply transition-[filter] duration-[380ms]${!isActive ? " blur-[2px]" : ""}`}
                      priority={i === 0}
                    />
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
