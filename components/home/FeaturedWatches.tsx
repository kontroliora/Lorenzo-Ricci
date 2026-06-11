"use client";
import { useState, useRef } from "react";
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
        <div
          className="sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="relative h-[400px] overflow-hidden"
            style={{ perspective: "1000px", perspectiveOrigin: "50% 25%" }}
          >
            {watches.map((watch, i) => {
              const diff = i - activeIndex;
              const isActive  = diff === 0;
              const isLeft    = diff === -1;
              const isRight   = diff === 1;
              const isVisible = Math.abs(diff) <= 1;

              const transform = isActive
                ? "translateX(0%) scale(1) rotateY(0deg)"
                : isLeft
                ? "translateX(-60%) scale(0.7) rotateY(40deg)"
                : isRight
                ? "translateX(60%) scale(0.7) rotateY(-40deg)"
                : diff < -1
                ? "translateX(-140%) scale(0.5) rotateY(50deg)"
                : "translateX(140%) scale(0.5) rotateY(-50deg)";

              return (
                <div
                  key={watch.id}
                  className="absolute inset-0 flex justify-center pt-1"
                  style={{
                    transform,
                    transition: "all 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    opacity:    isActive ? 1 : isVisible ? 0.42 : 0,
                    filter:     isVisible && !isActive ? "blur(1.5px)" : "none",
                    zIndex:     isActive ? 10 : isVisible ? 5 : 0,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="relative w-[72vw] max-w-[260px]">
                    <ProductCard product={watch} priority={i === 0} />
                    {!isActive && (
                      <div
                        className="absolute inset-0 z-20 cursor-pointer"
                        onClick={() => setActiveIndex(i)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nav arrows + dots */}
          <div className="flex items-center justify-center gap-5 mt-2">
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
                <p className="font-sans text-[9px] sm:text-xs font-medium tracking-[0.1em] sm:tracking-[0.18em] uppercase text-charcoal mb-1">{label}</p>
                <p className="font-sans text-[8px] sm:text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
