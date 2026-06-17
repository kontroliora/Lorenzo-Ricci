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

        {/* ── Category Banners — Desktop only ── */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-4 mb-16">
          {/* Chains banner */}
          <Link
            href="/jewellery?category=necklaces"
            className="group relative overflow-hidden h-[420px] block"
          >
            <Image
              src="/beautiful/banner-chains.webp"
              alt="Lorenzo Ricci Ланци — 18К позлата"
              fill
              quality={90}
              sizes="50vw"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
            <div className="absolute bottom-7 left-7 right-7">
              <p className="font-sans text-[9px] tracking-[0.32em] uppercase text-white/55 mb-2">
                Колекция
              </p>
              <h3 className="font-serif text-4xl text-white leading-tight mb-4">
                Ланци
              </h3>
              <span className="inline-flex items-center gap-2 font-sans text-[10px] tracking-[0.22em] uppercase text-white/65 group-hover:text-white transition-colors duration-300">
                Разгледай
                <span className="translate-x-0 group-hover:translate-x-1 transition-transform duration-300 inline-block">
                  →
                </span>
              </span>
            </div>
          </Link>

          {/* Bracelets banner */}
          <Link
            href="/jewellery?category=bracelets"
            className="group relative overflow-hidden h-[420px] block"
          >
            <Image
              src="/beautiful/banner-bracelets.webp"
              alt="Lorenzo Ricci Гривни — 18К позлата"
              fill
              quality={90}
              sizes="50vw"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
            <div className="absolute bottom-7 left-7 right-7">
              <p className="font-sans text-[9px] tracking-[0.32em] uppercase text-white/55 mb-2">
                Колекция
              </p>
              <h3 className="font-serif text-4xl text-white leading-tight mb-4">
                Гривни
              </h3>
              <span className="inline-flex items-center gap-2 font-sans text-[10px] tracking-[0.22em] uppercase text-white/65 group-hover:text-white transition-colors duration-300">
                Разгледай
                <span className="translate-x-0 group-hover:translate-x-1 transition-transform duration-300 inline-block">
                  →
                </span>
              </span>
            </div>
          </Link>
        </div>

        {/* ── Product grid — Mobile only ── */}
        <div className="lg:hidden">
          {/* Bracelets row */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-3">
              <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Гривни</p>
              <div className="flex-1 h-px bg-border" />
              <Link
                href="/jewellery?category=bracelets"
                className="font-sans text-[10px] tracking-[0.2em] uppercase text-navy/60 hover:text-navy transition-colors duration-200 flex items-center gap-1"
              >
                Виж всички <span className="inline-block">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {bracelets.map((b) => (
                <Link key={b.id} href={`/products/${b.slug}`} className="group flex flex-col">
                  <div className="relative aspect-square bg-white border border-border overflow-hidden">
                    <Image
                      src={b.coverImage.src}
                      alt={b.coverImage.alt}
                      fill
                      quality={80}
                      sizes="50vw"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2">
                    <h3 className="font-serif text-sm text-charcoal group-hover:text-navy transition-colors duration-200 leading-snug">
                      {b.name}
                    </h3>
                    <p className="font-serif text-xs text-navy mt-0.5">
                      {b.currency}{b.price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Necklaces row */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">Ланци</p>
              <div className="flex-1 h-px bg-border" />
              <Link
                href="/jewellery?category=necklaces"
                className="font-sans text-[10px] tracking-[0.2em] uppercase text-navy/60 hover:text-navy transition-colors duration-200 flex items-center gap-1"
              >
                Виж всички <span className="inline-block">→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {necklaces.map((n) => (
                <Link key={n.id} href={`/products/${n.slug}`} className="group flex flex-col">
                  <div className="relative aspect-square bg-white border border-border overflow-hidden">
                    <Image
                      src={n.coverImage.src}
                      alt={n.coverImage.alt}
                      fill
                      quality={80}
                      sizes="50vw"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2">
                    <h3 className="font-serif text-sm text-charcoal group-hover:text-navy transition-colors duration-200 leading-snug">
                      {n.name}
                    </h3>
                    <p className="font-serif text-xs text-navy mt-0.5">
                      {n.currency}{n.price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
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
