import type { Metadata } from "next";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";

export const metadata: Metadata = {
  title: "Кожени Изделия | Lorenzo Ricci",
  description:
    "Lorenzo Ricci кожени аксесоари - портфейли и кардхолдъри от 100% крокодилска кожа Crocodylus Siamensis. CITES сертифициран произход. Ръчна изработка.",
};

export default function LeatherGoodsPage() {
  const wallets     = products.filter((p) => p.category === "wallets");
  const cardholders = products.filter((p) => p.category === "cardholders");

  return (
    <div className="min-h-screen pt-20 pb-24">

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
            Crocodylus Siamensis
          </p>
          <h1 className="font-serif text-display-lg text-white mb-5">Кожени Изделия</h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/45 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            100% Крокодилска Кожа · CITES Сертифициран · Ръчна Изработка
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8">

        {/* ── Wallets ─────────────────────────────────────────── */}
        <div className="mt-20">
          <div className="flex items-center gap-5 mb-10">
            <div>
              <p className="section-tag mb-1">Колекция</p>
              <h2 className="font-serif text-display-sm text-charcoal">Портфейли</h2>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {wallets.map((w) => (
              <ProductCard key={w.id} product={w} />
            ))}
          </div>
        </div>

        {/* ── Cardholders ──────────────────────────────────────── */}
        <div className="mt-20">
          <div className="flex items-center gap-5 mb-10">
            <div>
              <p className="section-tag mb-1">Колекция</p>
              <h2 className="font-serif text-display-sm text-charcoal">Кардхолдъри</h2>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {cardholders.map((c) => (
              <ProductCard key={c.id} product={c} />
            ))}
          </div>
        </div>

        {/* ── Certificate strip ────────────────────────────────── */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-4 gap-0 border border-border">
          {[
            { title: "100% Крокодилска Кожа",  sub: "Вид Crocodylus Siamensis" },
            { title: "CITES Сертифициран",       sub: "Произход №: 25VN4174/S" },
            { title: "Ръчна Изработка",          sub: "Всяко изделие е уникално" },
            { title: "Луксозна Опаковка",        sub: "Със сертификат за автентичност" },
          ].map(({ title, sub }, i) => (
            <div
              key={title}
              className={`px-8 py-8 flex flex-col gap-2 ${i < 3 ? "sm:border-r border-border" : ""} border-b sm:border-b-0 border-border`}
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
              Често задавани въпроси
            </p>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                q: "От каква кожа са изработени продуктите?",
                a: "100% естествена крокодилска кожа вид Crocodylus Siamensis - една от най-редките кожи в света. Произходът е сертифициран по CITES № 25VN4174/S.",
              },
              {
                q: "Какво е CITES сертификат?",
                a: "Международен сертификат, гарантиращ законен и отговорен произход от лицензирана ферма. Получавате го физически с продукта.",
              },
              {
                q: "Всяко изделие уникално ли е?",
                a: "Да - ръчна изработка от майстор кожар. Естествената текстура на крокодилската кожа прави всяко изделие различно от останалите.",
              },
              {
                q: "Как да поддържам крокодилската кожа?",
                a: "Избягвайте влага и пряка слънчева светлина. Почиствайте с мека кърпа. Нанасяйте крем за екзотична кожа 1-2 пъти годишно.",
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
