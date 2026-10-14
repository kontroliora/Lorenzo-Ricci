"use client";
import Image from "next/image";
import Link from "next/link";
import { roBadge } from "@/components/ro/RoProductCard";
import { useReveal } from "@/lib/useReveal";
import { useLeatherStock } from "@/lib/use-gifts";
import { fmtRON } from "@/lib/ro/config";
import { ronOf, RO_CATEGORY_LABEL } from "@/lib/ro/config";
import type { Product, ProductCategory } from "@/lib/types";

// Romanian counterpart of components/home/WalletsSection.tsx. Instead of a hard-coded list it renders the products the
// page hands in (roEligible, price-overridden, localized), so names, sub-lines, images and lei prices always follow
// the catalogue. Live stock (wallet_inventory) adds "Epuizat" without hard-coding it.
const ROWS: { category: ProductCategory; cols: string; sizes: string }[] = [
  { category: "wallets",     cols: "grid-cols-2 sm:grid-cols-3", sizes: "(max-width: 640px) 50vw, 33vw" },
  { category: "cardholders", cols: "grid-cols-2 sm:grid-cols-3", sizes: "(max-width: 640px) 50vw, 33vw" },
  { category: "bags",        cols: "grid-cols-2 sm:grid-cols-5", sizes: "(max-width: 640px) 50vw, 20vw" },
];

function LeatherCard({ product, sold, sizes }: { product: Product; sold: boolean; sizes: string }) {
  const badge = roBadge(product.badge);
  return (
    <Link href={`/ro/produse/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-square bg-ivory-warm border border-border overflow-hidden">
        {badge && !sold && (
          <span className="absolute top-2 left-2 z-10 bg-white/90 text-navy border border-navy/20 font-sans text-[8px] sm:text-[9px] font-medium tracking-[0.16em] uppercase px-2 py-0.5">
            {badge}
          </span>
        )}
        <Image
          src={product.coverImage.src}
          alt={product.coverImage.alt}
          fill
          quality={80}
          sizes={sizes}
          className={`object-contain p-4 transition-transform duration-500 group-hover:scale-105 ${sold ? "opacity-50 grayscale" : ""}`}
        />
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase bg-charcoal text-white px-3 py-1.5">
              Epuizat
            </span>
          </div>
        )}
      </div>
      <div className="pt-2 sm:pt-3">
        <h3 className={`font-serif text-sm sm:text-base leading-snug ${sold ? "text-ink-faint" : "text-charcoal group-hover:text-navy transition-colors duration-200"}`}>
          {product.name}
        </h3>
        <p className="font-sans text-[10px] text-ink-muted mt-0.5 tracking-wide">
          {sold ? "Epuizat" : product.shortDescription}
        </p>
        <p className={`font-serif text-sm sm:text-base mt-1 ${sold ? "text-ink-faint" : "text-navy"}`}>
          {fmtRON(ronOf(product))}
        </p>
      </div>
    </Link>
  );
}

export function RoLeatherSection({ products }: { products: Product[] }) {
  const featuresRef = useReveal();
  // Live stock → "Epuizat". One batched call shared with the product cards; `inStock: false` in lib/products.ts
  // (the owner's single on/off switch) counts as sold out too.
  const stock = useLeatherStock(true);
  const isSold = (p: Product) => {
    const live = stock?.[p.slug];
    return (typeof live === "number" && live <= 0) || !p.inStock;
  };

  return (
    <section className="py-28 sm:py-40 bg-white border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <p className="section-tag mb-4">Crocodylus Siamensis</p>
          <h2 className="section-title mb-4">Articole din piele de crocodil</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-md mx-auto mt-6 tracking-wide leading-relaxed">
            Piele 100% naturală de crocodil · Certificat CITES · Lucrate manual
          </p>
        </div>

        {/* Wallets / cardholders / clutches rows */}
        {ROWS.map(({ category, cols, sizes }) => {
          const items = products.filter((p) => p.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-6 sm:mb-10">
              <div className="flex items-center gap-4 mb-3 sm:mb-5">
                <p className="font-sans text-[10px] tracking-[0.28em] uppercase text-ink-faint">{RO_CATEGORY_LABEL[category]}</p>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className={`grid ${cols} gap-2 sm:gap-3`}>
                {items.map((p) => (
                  <LeatherCard key={p.id} product={p} sold={isSold(p)} sizes={sizes} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="text-center mt-8 sm:mt-12 mb-8 sm:mb-16">
          <Link href="/ro/piele-de-crocodil" className="btn-outline">
            Vedeți toată colecția
          </Link>
        </div>

        {/* Certificate feature strip */}
        {/* Section-wide strip: it sits under products that don't all share one species or one CITES permit, so it
            states neither - each product's own specs carry its species. No gift box either: not every leather item
            ships in one. */}
        <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            {
              title: "Piele 100% de crocodil",
              desc: "Textură organică, specifică pielii autentice",
            },
            {
              title: "Certificat CITES",
              desc: "Origine documentată și legală",
            },
            {
              title: "Lucrate manual",
              desc: "Fiecare piesă este unică, confecționată manual de un meșter",
            },
          ].map(({ title, desc }, i) => (
            <div
              key={title}
              className={`reveal reveal-delay-${i + 1} flex flex-col items-center gap-3`}
            >
              <div className="w-px h-8 bg-navy/40 mb-1" />
              <h3 className="font-serif text-base text-charcoal">{title}</h3>
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
