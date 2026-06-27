import type { Metadata } from "next";
import Image from "next/image";
import { getWatches } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";

export const metadata: Metadata = {
  title: "Часовници",
  description:
    "Lorenzo Ricci колекция часовници - Chrono Black, Golden Eclipse, Polar Frost. Сапфирен кристал, японски механизъм, 5 ATM. Промоционална цена €175.",
};

export default function WatchesPage() {
  const watches = getWatches();

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      {/* Hero */}
      <div className="relative py-24 sm:py-32 px-5 sm:px-8 text-center overflow-hidden bg-navy border-b border-navy-dark">
        <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)"}} />
        <div className="relative z-10">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/45 mb-5">Lorenzo Ricci</p>
          <h1 className="font-serif text-display-lg text-white mb-5">Часовници</h1>
          <div className="w-10 h-px bg-white/25 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/50 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Сапфирен кристал · Японски механизъм · 5 ATM · 2г Гаранция
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {watches.map((watch, i) => (
            <ProductCard key={watch.id} product={watch} priority={i < 2} />
          ))}
        </div>

        {/* Editorial full-width image strip */}
        <div className="mt-20 grid grid-cols-3 gap-1 h-72 sm:h-96 overflow-hidden">
          {[
            { src: "/beautiful/chrono-rain.webp", label: "Chrono Black", alt: "Lorenzo Ricci Chrono Black хронограф в дъжд - водоустойчивост 5 ATM, черен циферблат 316L стомана" },
            { src: "/beautiful/polar-snow.webp",  label: "Polar Frost",   alt: "Lorenzo Ricci Polar Frost хронограф в сняг - арктическо синьо, японски механизъм" },
            { src: "/beautiful/eclipse-box.webp", label: "Golden Eclipse", alt: "Lorenzo Ricci Golden Eclipse позлатен хронограф с луксозна подаръчна кутия - 18K PVD" },
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
            <h2 className="font-serif text-display-sm text-charcoal mb-6">Хронографи с Характер</h2>
            <div className="gold-divider mb-6 mx-0" />
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
              Всеки часовник Lorenzo Ricci е проектиран с ясна цел - да бъде носен с увереност. Корпусите от хирургична стомана 316L, сапфиреното кристално стъкло и японските кварцови механизми дефинират нов стандарт за стойност в категорията на луксозните хронографи.
            </p>
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide mb-4">
              Частично скелетизираните циферблати разкриват прецизността отвътре, докато многофункционалните хронографи позволяват отчитане на времето с точност и стил.
            </p>
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
              Всеки модел е придружен от 2-годишна гаранция на механизма и е доставен в премиум кутия - готов за подаряване или за вас.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {[
              { title: "Сапфирен кристал", desc: "Единствено сапфиреното стъкло осигурява тази яснота и устойчивост на надраскване. Стандарт при часовниците на Rolex и Patek Philippe - сега достъпен за всеки." },
              { title: "Японски механизъм", desc: "Кварцовите механизми Miyota и Seiko са избор на марки по целия свят. Прецизност до ±15 секунди месечно. Живот на батерията 2-3 години." },
              { title: "5 ATM водоустойчивост", desc: "Защита при дъжд, плаж и случайно потапяне до 50 метра дълбочина. Всекидневна защита без компромис." },
            ].map(({ title, desc }) => (
              <div key={title} className="border-t border-border pt-6">
                <h3 className="font-serif text-lg text-charcoal mb-3">{title}</h3>
                <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Specs comparison */}
        <div className="mt-20 border border-border overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border bg-ivory-warm">
                <th className="py-4 px-6 text-left font-sans text-[10px] tracking-widest uppercase text-ink-faint w-40">
                  Спецификация
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
                { key: "Корпус" },
                { key: "Стъкло" },
                { key: "Механизъм" },
                { key: "Водоустойчивост" },
                { key: "Размери" },
              ].map(({ key }) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-sans text-[10px] tracking-widest uppercase text-ink-faint">
                    {key}
                  </td>
                  {watches.map((w) => {
                    const spec = w.specs.find((s) => s.label === key);
                    return (
                      <td key={w.id} className="py-3 px-6 text-center font-sans text-xs text-ink-soft font-light">
                        {spec?.value ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="py-4 px-6 font-sans text-[10px] tracking-widest uppercase text-ink-faint">
                  Цена
                </td>
                {watches.map((w) => (
                  <td key={w.id} className="py-4 px-6 text-center">
                    <span className="font-serif text-xl text-navy">€{w.price}</span>
                    {w.originalPrice && (
                      <span className="block font-sans text-xs text-ink-faint line-through">
                        €{w.originalPrice}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
