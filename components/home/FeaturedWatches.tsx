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
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);

  const prev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const next = () => setActiveIndex((i) => Math.min(watches.length - 1, i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 40) next();
    else if (diff < -40) prev();
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

        {/* ── Mobile Cover Flow ────────────────────────────────────────────── */}
        {/*
          Layout (375px screen example):
          Left card  — center at 18vw, visual width 36vw → shows 0..36vw
          Center card — center at 50vw, visual width 56vw → shows 22vw..78vw
          Right card  — center at 82vw, visual width 36vw → shows 64vw..100vw
          Side cards slide behind center (z-index 5 vs 10).
          White BG + mix-blend-multiply makes product white-bg images appear transparent.
        */}
        <div
          className="sm:hidden overflow-x-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image strip */}
          <div className="relative" style={{ height: "56vw" }}>
            {watches.map((watch, i) => {
              const diff = i - activeIndex;
              const isActive  = diff === 0;
              const isVisible = Math.abs(diff) === 1;

              const xShift =
                diff === 0  ? "0vw"   :
                diff === -1 ? "-32vw" :
                diff ===  1 ? "32vw"  :
                diff  <  -1 ? "-110vw": "110vw";

              const scale   = isActive ? 1 : isVisible ? 0.65 : 0.4;
              const opacity = isActive ? 1 : isVisible ? 0.82 : 0;

              return (
                <div
                  key={watch.id}
                  className="absolute top-0"
                  style={{
                    left: "50%",
                    width: "56vw",
                    transform: `translateX(-50%) translateX(${xShift}) scale(${scale})`,
                    transformOrigin: "top center",
                    transition:
                      "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94), " +
                      "opacity 0.38s ease, filter 0.38s ease",
                    opacity,
                    filter: isVisible ? "blur(2px)" : "none",
                    zIndex: isActive ? 10 : isVisible ? 5 : 0,
                  }}
                >
                  {/* bg-white + mix-blend-multiply = white pixels become transparent */}
                  <div className="relative aspect-square bg-white">
                    <Image
                      src={watch.coverImage.src}
                      alt={watch.coverImage.alt}
                      fill
                      quality={72}
                      sizes="56vw"
                      className="object-contain mix-blend-multiply"
                      priority={i === 0}
                    />
                  </div>

                  {/* Tap overlay on side cards to jump to them */}
                  {!isActive && (
                    <div
                      className="absolute inset-0 z-20 cursor-pointer"
                      onClick={() => setActiveIndex(i)}
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

          {/* Navigation — arrows + dots */}
          <div className="flex items-center justify-center gap-5 mt-6">
            <button
              onClick={prev}
              disabled={activeIndex === 0}
              aria-label="Предишен"
              className="w-8 h-8 rounded-full border border-navy/40 flex items-center justify-center text-navy text-xl leading-none disabled:opacity-20 transition-all active:scale-90"
            >
              ‹
            </button>
            <div className="flex items-center gap-2">
              {watches.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Часовник ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-5 bg-navy" : "w-1.5 bg-navy/25"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              disabled={activeIndex === watches.length - 1}
              aria-label="Следващ"
              className="w-8 h-8 rounded-full border border-navy/40 flex items-center justify-center text-navy text-xl leading-none disabled:opacity-20 transition-all active:scale-90"
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
