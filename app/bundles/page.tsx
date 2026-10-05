import type { Metadata } from "next";
import { BUNDLES, bundleHasSaleItem } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { BundlesClient } from "./BundlesClient";

export const metadata: Metadata = {
  title: "Комплекти",
  description:
    "Завърши визията с подбрани комплекти от бижута Lorenzo Ricci. Съчетай гривна и колие от една колекция и получи 10% отстъпка.",
};

// Durable price overrides (supabase/product_price_overrides.sql, read via
// lib/price-overrides.ts) — page stays statically generated; the admin discount
// route calls revalidatePath("/bundles") on every write so a change shows up
// within seconds without a fresh deploy.

export default async function BundlesPage() {
  const overrides = await getPriceOverrides();
  // bundleHasSaleItem must see the SAME (overridden) prices used for display below,
  // so a bundle with a just-discounted item is correctly hidden (no stacking).
  const findProduct = (slug: string) => {
    const p = getProductBySlug(slug);
    return p ? applyOverride(p, overrides) : undefined;
  };
  const bundles = BUNDLES.flatMap((bundle) => {
    const productA = findProduct(bundle.slots[0][0]);
    const productB = findProduct(bundle.slots[1][0]);
    // A set with a sale item earns no set discount (no stacking) - don't advertise it.
    if (!productA || !productB || bundleHasSaleItem(bundle, findProduct)) return [];
    return [{ id: bundle.id, label: bundle.label, productA, productB, discountPct: bundle.discountPct, slots: bundle.slots }];
  });

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
          <h1 className="font-serif text-display-lg text-white mb-5">Комплекти</h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/45 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Завърши визията · -10% при покупка в комплект
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-16">
        {/* Section intro */}
        <div className="text-center mb-14">
          <p className="section-tag mb-4">Подбрани комбинации</p>
          <h2 className="section-title mb-4">Перфектната комбинация</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-lg mx-auto mt-6 leading-relaxed tracking-wide">
            Съчетай гривна и колие от една колекция и спести 10% от цената на комплекта.
            Отстъпката се прилага автоматично в количката.
          </p>
        </div>

        {/* Bundle cards */}
        <BundlesClient bundles={bundles} />

        {/* Trust strip */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-0 border border-border">
          {[
            { title: "Автоматична отстъпка",  sub: "Прилага се директно в количката" },
            { title: "Наложен платеж",         sub: "Плащате при получаване" },
            { title: "Доживотна гаранция",     sub: "На всички бижута" },
          ].map(({ title, sub }, i) => (
            <div
              key={title}
              className={`px-8 py-7 flex flex-col gap-2 ${i < 2 ? "sm:border-r border-border" : ""} border-b sm:border-b-0 border-border`}
            >
              <div className="w-4 h-px bg-navy/40 mb-1" />
              <p className="font-sans text-[11px] font-medium tracking-[0.18em] uppercase text-charcoal">{title}</p>
              <p className="font-sans text-[10px] font-light text-ink-faint tracking-wide">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
