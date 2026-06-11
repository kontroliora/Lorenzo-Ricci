"use client";
import { getWatches } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";
import { useReveal } from "@/lib/useReveal";

export function FeaturedWatches() {
  const watches = getWatches();
  const gridRef = useReveal();

  return (
    <section className="py-28 sm:py-40 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
      <div className="text-center mb-16">
        <p className="section-tag mb-4">Колекция Часовници</p>
        <h2 className="section-title mb-4">Избери Своя Стил</h2>
        <div className="gold-divider" />
        <p className="font-sans text-sm font-light text-ink-muted max-w-lg mx-auto mt-6 leading-relaxed tracking-wide">
          Сапфирен кристал · Японски механизъм · 5 ATM водоустойчивост
        </p>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
        {watches.map((watch, i) => (
          <div key={watch.id} className={`reveal reveal-delay-${i + 1}`}>
            <ProductCard product={watch} priority={i < 2} />
          </div>
        ))}
      </div>

      {/* Trust strip */}
      <div className="mt-16 border-y border-border py-8">
        <div className="grid grid-cols-3 gap-0 text-center divide-x divide-border">
          {[
            { label: "Безплатна доставка", sub: "За поръчки над €80" },
            { label: "2 Години Гаранция", sub: "На всеки механизъм" },
            { label: "Преглед преди плащане", sub: "Наложен платеж" },
          ].map(({ label, sub }) => (
            <div key={label} className="px-6 py-2">
              <p className="font-sans text-xs font-medium tracking-[0.18em] uppercase text-charcoal mb-1">{label}</p>
              <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      </div>
    </section>
  );
}
