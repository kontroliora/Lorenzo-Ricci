"use client";
import Image from "next/image";
import Link from "next/link";
import { getBracelets, getNecklaces } from "@/lib/products";
import { useReveal } from "@/lib/useReveal";

export function JewellerySection() {
  const bracelets = getBracelets();
  const necklaces = getNecklaces();
  const featuresRef = useReveal();

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <p className="section-tag mb-4">Колекция Бижута</p>
          <h2 className="section-title mb-4">Колекция Бижута</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 tracking-wide leading-relaxed">
            18К позлата · Италиански дизайн · Вечен стил
          </p>
        </div>

        {/* Bracelets row */}
        <div className="mb-6 sm:mb-10">
          <div className="flex items-center gap-4 mb-3 sm:mb-5">
            <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Гривни</p>
            <div className="flex-1 h-px bg-border" />
            <Link
              href="/jewellery?category=bracelets"
              className="font-sans text-[10px] tracking-[0.2em] uppercase text-navy/60 hover:text-navy transition-colors duration-200 flex items-center gap-1"
            >
              Виж всички <span className="group-hover:translate-x-0.5 inline-block">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {bracelets.map((b) => (
              <Link
                key={b.id}
                href={`/products/${b.slug}`}
                className="group flex flex-col"
              >
                <div className="relative aspect-square bg-white border border-border overflow-hidden">
                  <Image
                    src={b.coverImage.src}
                    alt={b.coverImage.alt}
                    fill
                    quality={80}
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="pt-2 sm:pt-3">
                  <h3 className="font-serif text-sm sm:text-base text-charcoal group-hover:text-navy transition-colors duration-200 leading-snug">
                    {b.name}
                  </h3>
                  <p className="font-serif text-xs sm:text-sm text-navy mt-0.5">
                    {b.currency}{b.price.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Necklaces row */}
        <div className="mb-8 sm:mb-16">
          <div className="flex items-center gap-4 mb-3 sm:mb-5">
            <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Колиета</p>
            <div className="flex-1 h-px bg-border" />
            <Link
              href="/jewellery?category=necklaces"
              className="font-sans text-[10px] tracking-[0.2em] uppercase text-navy/60 hover:text-navy transition-colors duration-200 flex items-center gap-1"
            >
              Виж всички <span className="inline-block">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {necklaces.map((n) => (
              <Link
                key={n.id}
                href={`/products/${n.slug}`}
                className="group flex flex-col"
              >
                <div className="relative aspect-square bg-white border border-border overflow-hidden">
                  <Image
                    src={n.coverImage.src}
                    alt={n.coverImage.alt}
                    fill
                    quality={80}
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="pt-2 sm:pt-3">
                  <h3 className="font-serif text-sm sm:text-base text-charcoal group-hover:text-navy transition-colors duration-200 leading-snug">
                    {n.name}
                  </h3>
                  <p className="font-serif text-xs sm:text-sm text-navy mt-0.5">
                    {n.currency}{n.price.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Feature row */}
        <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center mb-8 sm:mb-16">
          {[
            { title: "18K PVD Позлата", desc: "4-слойно покритие, устойчиво на вода, пот и парфюм" },
            { title: "316L Стомана", desc: "Хипоалергенна основа - безопасна за всяка кожа" },
            { title: "Доживотна Гаранция", desc: "Стоим зад всяко бижу без изключение" },
          ].map(({ title, desc }, i) => (
            <div key={title} className={`reveal reveal-delay-${i + 1} flex flex-col items-center gap-3`}>
              <div className="w-px h-8 bg-navy/40 mb-1" />
              <h3 className="font-serif text-xl text-charcoal">{title}</h3>
              <p className="font-sans text-xs font-light text-ink-muted tracking-wide leading-relaxed max-w-xs">
                {desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
