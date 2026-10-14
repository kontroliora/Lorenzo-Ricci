import type { Metadata } from "next";
import Image from "next/image";
import { products } from "@/lib/products";
import { RoProductCard } from "@/components/ro/RoProductCard";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { localizeProduct } from "@/lib/ro/catalog";
import { roEligible, ronOf, ronOriginalOf, fmtRON } from "@/lib/ro/config";
import { roToBgPath } from "@/lib/ro/route-map";

// Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts) - the page stays
// statically generated; the admin discount route revalidates it. All six watches are listed (same set as RO_SLUGS), with
// the same sale (current price, old price crossed out, badge) as on the Bulgarian site.

const PATH = "/ro/ceasuri";

// Price wording comes from the catalogue so it can never drift from the real prices.
const roWatches = products.filter((p) => p.category === "watches" && roEligible(p));
const watchPrices = roWatches.map((w) => ronOf(w));
const lowestWatchPrice = Math.min(...watchPrices);
const priceNote =
  lowestWatchPrice === Math.max(...watchPrices)
    ? `Preț ${fmtRON(lowestWatchPrice)}.`
    : `Preț de la ${fmtRON(lowestWatchPrice)}.`;

const DESCRIPTION = `Colecția de ceasuri Lorenzo Ricci - Yachting, Chrono Black, Golden Eclipse, Polar Frost. Sticlă safir, mecanism japonez, 5 ATM. ${priceNote}`;

export const metadata: Metadata = {
  title: "Ceasuri",
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "ceasuri de lux", "cronograf", "sticlă safir", "mecanism japonez", "Yachting", "Chrono Black", "Golden Eclipse", "Polar Frost"],
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: { "ro-RO": `https://lorenzo-ricci.com${PATH}`, "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}` },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: `https://lorenzo-ricci.com${PATH}`,
    title: "Ceasuri | Lorenzo Ricci",
    description: DESCRIPTION,
  },
};

export default async function RoWatchesPage() {
  const overrides = await getPriceOverrides();
  const watches = applyOverrides(roWatches, overrides).map(localizeProduct);

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      {/* Hero */}
      <div className="relative py-24 sm:py-32 px-5 sm:px-8 text-center overflow-hidden bg-navy border-b border-navy-dark">
        <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)"}} />
        <div className="relative z-10">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/45 mb-5">Lorenzo Ricci</p>
          <h1 className="font-serif text-display-lg text-white mb-5">Ceasuri</h1>
          <div className="w-10 h-px bg-white/25 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/50 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Sticlă safir · Mecanism japonez · 5 ATM · 5 ani garanție comercială
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {watches.map((watch, i) => (
            <RoProductCard key={watch.id} product={watch} priority={i < 2} />
          ))}
        </div>

        {/* Editorial full-width image strip */}
        <div className="mt-20 grid grid-cols-3 gap-1 h-72 sm:h-96 overflow-hidden">
          {[
            { src: "/beautiful/chrono-rain.webp", label: "Chrono Black", alt: "Lorenzo Ricci Chrono Black - cronograf în ploaie, rezistență la apă 5 ATM, cadran negru, oțel 316L" },
            { src: "/beautiful/polar-snow.webp",  label: "Polar Frost",   alt: "Lorenzo Ricci Polar Frost - cronograf în zăpadă, albastru arctic, mecanism japonez" },
            { src: "/beautiful/eclipse-box.webp", label: "Golden Eclipse", alt: "Lorenzo Ricci Golden Eclipse - cronograf placat cu aur, cu cutie cadou de lux, 18K PVD" },
          ].map(({ src, label, alt }) => (
            <div key={label} className="relative overflow-hidden group">
              <Image src={src} alt={alt} fill quality={85} sizes="33vw"
                className="object-cover object-center transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors duration-500" />
              <div className="absolute bottom-4 left-4">
                <p className="font-sans text-[9px] tracking-[0.25em] uppercase text-white/70">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Collection description */}
        <div className="mt-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="section-tag mb-4">Noble Vanguard Collection</p>
            <h2 className="font-serif text-display-sm text-charcoal mb-6">Cronografe cu caracter</h2>
            <div className="gold-divider mb-6 mx-0" />
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
              Fiecare ceas Lorenzo Ricci este conceput cu un scop clar: să fie purtat cu încredere. Carcasele din oțel chirurgical 316L, sticla safir și mecanismele quartz japoneze definesc un nou standard de valoare în categoria cronografelor de lux.
            </p>
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
              Cadranele parțial scheletate dezvăluie precizia din interior, iar cronografele multifuncționale permit măsurarea timpului cu exactitate și stil.
            </p>
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
              Fiecare model beneficiază de garanție comercială de 5 ani pentru mecanism și este livrat într-o cutie premium - gata de oferit cadou sau pentru dumneavoastră.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {[
              { title: "Sticlă safir", desc: "Doar sticla safir oferă această claritate și rezistență la zgârieturi - un material folosit în orologeria de top, aici accesibil tuturor." },
              { title: "Mecanism japonez", desc: "Mecanismele quartz Miyota și Seiko sunt alese de mărci din întreaga lume. Precizie de până la ±15 secunde pe lună. Durata de viață a bateriei: 2-3 ani." },
              { title: "Rezistență la apă 5 ATM", desc: "Protecție la ploaie, la plajă și la scufundarea accidentală, până la 50 de metri adâncime. Protecție zilnică, fără compromisuri." },
            ].map(({ title, desc }) => (
              <div key={title} className="border-t border-border pt-6">
                <h3 className="font-serif text-lg text-charcoal mb-3">{title}</h3>
                <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Specs comparison */}
        <div className="relative mt-20 border border-border overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border bg-ivory-warm">
                <th className="py-4 px-6 text-left font-sans text-[10px] tracking-widest uppercase text-ink-faint w-40">
                  Specificații
                </th>
                {watches.map((w) => (
                  <th key={w.id} className="py-4 px-6 text-center font-serif text-base text-charcoal">
                    {w.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: "Carcasă" },
                { key: "Sticlă" },
                { key: "Mecanism" },
                { key: "Rezistență la apă" },
                { key: "Dimensiuni" },
              ].map(({ key }) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-sans text-[10px] tracking-widest uppercase text-ink-faint">
                    {key}
                  </td>
                  {watches.map((w) => {
                    const spec = w.specs.find((s) => s.label === key);
                    return (
                      <td key={w.id} className="py-3 px-6 text-center font-sans text-xs text-ink-soft font-light">
                        {spec?.value || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="py-4 px-6 font-sans text-[10px] tracking-widest uppercase text-ink-faint">
                  Preț
                </td>
                {watches.map((w) => {
                  const original = ronOriginalOf(w);
                  return (
                    <td key={w.id} className="py-4 px-6 text-center">
                      <span className="font-serif text-xl text-navy">{fmtRON(ronOf(w))}</span>
                      {original !== undefined && (
                        <span className="block font-sans text-xs text-ink-faint line-through mt-0.5">
                          <span className="sr-only">Preț inițial: </span>
                          {fmtRON(original)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
