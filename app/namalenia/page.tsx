import type { Metadata } from "next";
import { products } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { discountedProducts, discountPct } from "@/lib/sale-campaign";
import { ProductCard } from "@/components/product/ProductCard";

export const metadata: Metadata = {
  title: "Намаления",
  description: "Всички намалени часовници, бижута и кожени изделия Lorenzo Ricci, подредени по размер на отстъпката.",
};

// Re-checked every 5 minutes (sold-out list and prices), like the homepage.
export const revalidate = 300;

// Every product on sale that can be bought now (in stock, not switched off), biggest discount first (lib/sale-campaign.ts).
export default async function SalePage() {
  const [overrides, soldOut] = await Promise.all([getPriceOverrides(), getSoldOutSlugs()]);
  const list = discountedProducts(applyOverrides(products, overrides), new Set(soldOut));

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="relative py-20 sm:py-28 px-5 sm:px-8 text-center bg-[#B3121F]">
        <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/70 mb-5">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-white mb-5">Намаления</h1>
        <div className="w-10 h-px bg-white/40 mx-auto my-5" />
        <p className="font-sans text-xs font-light text-white/80 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
          {list.length ? `${list.length} ${list.length === 1 ? "продукт" : "продукта"} · подредени по отстъпка` : "В момента няма намалени продукти"}
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-12">
        {list.length ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8" data-testid="sale-grid">
            {list.map((p, i) => (
              <div key={p.slug} data-slug={p.slug} data-discount={Math.round(discountPct(p))}>
                <ProductCard product={p} priority={i < 2} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-ink-muted">Разгледайте всички <a className="underline" href="/watches">часовници</a> и <a className="underline" href="/jewellery">бижута</a>.</p>
        )}
      </div>
    </div>
  );
}
