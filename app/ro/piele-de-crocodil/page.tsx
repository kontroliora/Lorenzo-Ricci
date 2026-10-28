import type { Metadata } from "next";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { soldOutLast } from "@/lib/sold-out-order";
import { products } from "@/lib/products";
import { RoProductCard } from "@/components/ro/RoProductCard";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { localizeProduct } from "@/lib/ro/catalog";
import { roEligible, RO_CATEGORY_LABEL } from "@/lib/ro/config";
import { roToBgPath } from "@/lib/ro/route-map";

const PATH = "/ro/piele-de-crocodil";

// Page-wide wording names no species: the range holds more than one (the one-off bag Milano Avorio is a Nile crocodile)
// and each product's own specs carry its species. Same approach as the Bulgarian certificate strip and FAQ below.
const DESCRIPTION =
  "Articole din piele de crocodil Lorenzo Ricci - portofele, port-carduri, clutch-uri și genți din piele 100% naturală de crocodil. Origine documentată prin certificat CITES. Lucrate manual.";

export const metadata: Metadata = {
  title: "Articole din piele de crocodil",
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "piele de crocodil", "portofel piele de crocodil", "port-card piele de crocodil", "clutch piele de crocodil", "geantă piele de crocodil", "CITES"],
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: { "ro-RO": `https://lorenzo-ricci.com${PATH}`, "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}` },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: `https://lorenzo-ricci.com${PATH}`,
    title: "Articole din piele de crocodil | Lorenzo Ricci",
    description: DESCRIPTION,
  },
};

// Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts) - the page stays
// statically generated; the admin discount route revalidates it. Every leather product is listed (same set as RO_SLUGS),
// including the one-off bag Milano Avorio, which is sold on prepayment: its card looks like any other.

// Sold-out products are listed last (lib/sold-out-order.ts); the sold-out list is re-read every 5 minutes.
export const revalidate = 300;

export default async function RoLeatherPage() {
  const overrides = await getPriceOverrides();
  const catalog = applyOverrides(products.filter(roEligible), overrides).map(localizeProduct);
  const soldOut = new Set(await getSoldOutSlugs());
  const last = <T extends { slug: string }>(l: T[]) => soldOutLast(l, (s) => soldOut.has(s));
  const wallets     = last(catalog.filter((p) => p.category === "wallets"));
  const cardholders = last(catalog.filter((p) => p.category === "cardholders"));
  const bags        = last(catalog.filter((p) => p.category === "bags"));

  const sections = [
    { key: "wallets",     title: RO_CATEGORY_LABEL.wallets,     items: wallets,     gap: "gap-10" },
    { key: "cardholders", title: RO_CATEGORY_LABEL.cardholders, items: cardholders, gap: "gap-8" },
    // The Bulgarian page calls this section "Bags": it holds the clutches AND the one-off bag, so not the narrower "Clutch-uri" label.
    { key: "bags",        title: "Genți",                       items: bags,        gap: "gap-10" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen pt-[116px] pb-24">

      {/* Hero */}
      <div className="relative py-24 sm:py-32 px-5 sm:px-8 text-center overflow-hidden bg-charcoal-deep border-b border-white/5">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)",
          }}
        />
        <div className="relative z-10">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/40 mb-5">
            Lorenzo Ricci
          </p>
          <h1 className="font-serif text-display-lg text-white mb-5">Articole din piele de crocodil</h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/45 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Piele 100% de crocodil · Certificat CITES · Lucrate manual
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* ── Wallets / cardholders / clutches ─────────────────── */}
        {sections.map(({ key, title, items, gap }) => (
          <div key={key} className="mt-20">
            <div className="flex items-center gap-5 mb-10">
              <div>
                <p className="section-tag mb-1">Colecție</p>
                <h2 className="font-serif text-display-sm text-charcoal">{title}</h2>
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gap}`}>
              {items.map((p) => (
                <RoProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        ))}

        {/* ── Certificate strip ────────────────────────────────── */}
        {/* Page-wide strip under products that don't all share one species or permit: no species, no permit number -
            each product's specs carry its own. No gift-box column: not every item ships in a gift box. */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-0 border border-border">
          {[
            { title: "Piele 100% de crocodil", sub: "Relief și textură naturale" },
            { title: "Certificat CITES",        sub: "Origine documentată și legală" },
            { title: "Lucrate manual",          sub: "Fiecare piesă este unică" },
          ].map(({ title, sub }, i, all) => (
            <div
              key={title}
              // Dividers between items only - the outer border already frames the last one.
              className={`px-8 py-8 flex flex-col gap-2 border-border ${i < all.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""}`}
            >
              <div className="w-4 h-px bg-navy/40 mb-1" />
              <p className="font-sans text-[11px] font-medium tracking-[0.18em] uppercase text-charcoal">{title}</p>
              <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <div className="mt-16 mb-4">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-4 h-px bg-navy/30" />
            <p className="font-sans text-[10px] font-medium tracking-[0.26em] uppercase text-navy">
              Întrebări frecvente
            </p>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                q: "Din ce piele sunt confecționate produsele?",
                // Page-wide answer: no species or permit number here - both are in each product's own specs.
                a: "Din piele 100% naturală de crocodil. Specia este indicată în specificațiile fiecărui produs, iar originea este documentată printr-un certificat CITES.",
              },
              {
                q: "Ce este certificatul CITES?",
                a: "Un certificat internațional care garantează o origine legală și responsabilă, dintr-o fermă autorizată. Îl primiți fizic, împreună cu produsul.",
              },
              {
                q: "Este fiecare piesă unică?",
                a: "Da - sunt confecționate manual de un meșter pielar. Textura naturală a pielii de crocodil face ca fiecare piesă să fie diferită de celelalte.",
              },
              {
                q: "Cum îngrijesc pielea de crocodil?",
                a: "Evitați umezeala și lumina directă a soarelui. Curățați cu o lavetă moale. Aplicați o cremă pentru piele exotică de 1-2 ori pe an.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-t border-border pt-6">
                <p className="font-serif text-base text-charcoal mb-3">{q}</p>
                <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">{a}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
