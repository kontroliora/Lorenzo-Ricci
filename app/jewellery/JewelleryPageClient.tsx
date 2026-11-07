"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { collectionRank, isCollectionSlug } from "@/lib/new-collection";
import { ProductCard } from "@/components/product/ProductCard";

interface Props {
  bracelets: Product[];
  necklaces: Product[];
}

/** Reads ?category= (tabs). Needs a <Suspense> around it; its fallback is JewelleryPageView with category null - the full page, drawn on the
 *  server - so the page is in the HTML and nothing jumps when this takes over in the browser (it used to be an empty
 *  fallback: the footer moved down by a whole screen, CLS 0.9-1.0). */
export function JewelleryPageClient(props: Props) {
  const category = useSearchParams().get("category");
  return <JewelleryPageView {...props} category={category} />;
}

export function JewelleryPageView({ bracelets, necklaces, category }: Props & { category: string | null }) {
  // category: "bracelets" | "necklaces" | null

  const showBracelets = !category || category === "bracelets";
  const showNecklaces = !category || category === "necklaces";

  // A link with an #anchor (the menu's #damska-kolekcia / #colectia-pentru-femei, the home banners' #bracelets / #necklaces): this grid is
  // drawn in the browser, after the browser's own jump to the anchor, so jump once it exists (the CSS scroll-margin clears the header).
  // The section was renamed (#nova-kolekcia -> #damska-kolekcia): old links (ads, bookmarks, shared links) are rewritten to the new anchor.
  useEffect(() => {
    let t = 0;
    const jump = () => {
      let id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      if (id === "nova-kolekcia") { id = "damska-kolekcia"; window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`); }
      window.clearTimeout(t);
      t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    };
    jump();
    window.addEventListener("hashchange", jump);
    return () => { window.clearTimeout(t); window.removeEventListener("hashchange", jump); };
  }, [category]);

  // The 2026 collection (lib/new-collection.ts) gets its own section first. The existing range follows under the info block
  // whose "750 IT" stamp line belongs to it only - the new pieces carry no stamp (owner, 07.11.2026).
  const newPieces = [...(showBracelets ? bracelets : []), ...(showNecklaces ? necklaces : [])].filter((p) => isCollectionSlug(p.slug))
    .sort((a, b) => collectionRank(a.slug) - collectionRank(b.slug)); // by model, necklaces before bracelets
  const oldBracelets = bracelets.filter((p) => !isCollectionSlug(p.slug));
  const oldNecklaces = necklaces.filter((p) => !isCollectionSlug(p.slug));
  const showOldRange = (showBracelets && oldBracelets.length > 0) || (showNecklaces && oldNecklaces.length > 0);

  const infoBlock = (className: string) => (
      <div className={`${className} p-8 sm:p-12 bg-ivory-warm border border-border`}>
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
  );

  return (
    <div className="min-h-screen pt-[116px] pb-24">
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

        {/* The 2026 collection */}
        {newPieces.length > 0 && (
          <div id="damska-kolekcia" data-testid="new-collection" className="mb-20 scroll-mt-[132px]">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Lorenzo Ricci</p>
                <h2 className="font-serif text-display-sm text-charcoal">Дамска колекция</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {newPieces.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 2} />
              ))}
            </div>
          </div>
        )}

        {/* Milano Gold info block: with the new collection on the page it heads the existing range (its "750 IT" stamp line is
            theirs only); without it, it stays at the bottom as before. */}
        {newPieces.length > 0 && showOldRange && infoBlock("mb-20")}

        {/* Bracelets */}
        {showBracelets && oldBracelets.length > 0 && (
          <div id="bracelets" className="mb-20 scroll-mt-[132px]">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Lorenzo Ricci</p>
                <h2 className="font-serif text-display-sm text-charcoal">Гривни</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {oldBracelets.map((b, i) => (
                <ProductCard key={b.id} product={b} priority={newPieces.length === 0 && i < 2} />
              ))}
            </div>
          </div>
        )}

        {/* Necklaces */}
        {showNecklaces && oldNecklaces.length > 0 && (
          <div id="necklaces" className="scroll-mt-[132px]">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="section-tag mb-2">Lorenzo Ricci</p>
                <h2 className="font-serif text-display-sm text-charcoal">Колиета</h2>
              </div>
              <div className="h-px flex-1 bg-border ml-8" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
              {oldNecklaces.map((n, i) => (
                <ProductCard key={n.id} product={n} priority={newPieces.length === 0 && i < 2} />
              ))}
            </div>
          </div>
        )}

        {newPieces.length === 0 && infoBlock("mt-20")}
      </div>
    </div>
  );
}
