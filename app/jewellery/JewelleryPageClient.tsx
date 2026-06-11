"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBracelets, getNecklaces } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";

export function JewelleryPageClient() {
  const params = useSearchParams();
  const category = params.get("category"); // "bracelets" | "necklaces" | null

  const bracelets = getBracelets();
  const necklaces = getNecklaces();

  const showBracelets = !category || category === "bracelets";
  const showNecklaces = !category || category === "necklaces";

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Hero */}
      <div className="relative py-24 sm:py-32 px-5 sm:px-8 text-center overflow-hidden bg-navy border-b border-navy-dark">
        <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)"}} />
        <div className="relative z-10">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/45 mb-5">Lorenzo Ricci · Колекция Бижута</p>
          <h1 className="font-serif text-display-lg text-white mb-5">
            {category === "bracelets" ? "Гривни" : category === "necklaces" ? "Колиета" : "Бижута"}
          </h1>
          <div className="w-10 h-px bg-white/25 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/50 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            18К позлата · Италиански дизайн · Доживотна гаранция
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-12">
        {/* Category filter tabs */}
        <div className="flex items-center gap-6 mb-12 border-b border-border pb-4">
          <Link
            href="/jewellery"
            className={`font-sans text-xs tracking-[0.18em] uppercase transition-colors duration-200 pb-4 -mb-4 border-b-2 ${
              !category ? "border-navy text-navy" : "border-transparent text-ink-muted hover:text-charcoal"
            }`}
          >
            Всички ({bracelets.length + necklaces.length})
          </Link>
          <Link
            href="/jewellery?category=bracelets"
            className={`font-sans text-xs tracking-[0.18em] uppercase transition-colors duration-200 pb-4 -mb-4 border-b-2 ${
              category === "bracelets" ? "border-navy text-navy" : "border-transparent text-ink-muted hover:text-charcoal"
            }`}
          >
            Гривни ({bracelets.length})
          </Link>
          <Link
            href="/jewellery?category=necklaces"
            className={`font-sans text-xs tracking-[0.18em] uppercase transition-colors duration-200 pb-4 -mb-4 border-b-2 ${
              category === "necklaces" ? "border-navy text-navy" : "border-transparent text-ink-muted hover:text-charcoal"
            }`}
          >
            Колиета ({necklaces.length})
          </Link>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 mb-12 border-y border-border">
          {[
            { val: "18K", label: "PVD Позлата" },
            { val: "4", label: "Слоя покритие" },
            { val: "316L", label: "Хирургична стомана" },
            { val: "∞", label: "Гаранция" },
          ].map(({ val, label }) => (
            <div key={label} className="text-center py-2">
              <p className="font-serif text-3xl text-navy mb-1">{val}</p>
              <p className="font-sans text-[10px] tracking-widest uppercase text-ink-faint">{label}</p>
            </div>
          ))}
        </div>

        {/* Bracelets */}
        {showBracelets && (
          <div id="bracelets" className="mb-20 scroll-mt-24">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Lorenzo Ricci</p>
                <h2 className="font-serif text-display-sm text-charcoal">Гривни</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {bracelets.map((b, i) => (
                <ProductCard key={b.id} product={b} priority={i < 2} />
              ))}
            </div>
          </div>
        )}

        {/* Necklaces */}
        {showNecklaces && (
          <div id="necklaces" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Lorenzo Ricci</p>
                <h2 className="font-serif text-display-sm text-charcoal">Колиета</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {necklaces.map((n, i) => (
                <ProductCard key={n.id} product={n} priority={i < 2} />
              ))}
            </div>
          </div>
        )}

        {/* Milano Gold info block */}
        <div className="mt-20 p-8 sm:p-12 bg-ivory-warm border border-border">
          <div className="max-w-2xl mx-auto text-center">
            <p className="section-tag mb-4">Защо Lorenzo Ricci?</p>
            <h3 className="font-serif text-display-sm text-charcoal mb-6">4-слойно 18K PVD покритие</h3>
            <div className="gold-divider" />
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed mt-6 mb-8">
              За разлика от стандартното единично покритие, нашите бижута преминават
              през 4 последователни слоя 18K PVD злато. Резултатът е значително по-плътна
              и по-устойчива повърхност - не избледнява при контакт с вода, пот или парфюм.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { text: "Устойчиво на вода и пот" },
                { text: "Печат 750 IT · Италиански дизайн" },
                { text: "Доживотна гаранция" },
              ].map(({ text }) => (
                <div key={text} className="flex flex-col items-center gap-2 text-center">
                  <div className="w-px h-6 bg-navy/30" />
                  <span className="font-sans text-xs text-ink-soft tracking-wide">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
