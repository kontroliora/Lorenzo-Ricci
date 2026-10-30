import type { Metadata } from "next";
import { products } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { discountedProducts, discountPct } from "@/lib/sale-campaign";
import { localizeProduct } from "@/lib/ro/catalog";
import { roEligible } from "@/lib/ro/config";
import { roToBgPath } from "@/lib/ro/route-map";
import { RoProductCard } from "@/components/ro/RoProductCard";

// Romanian counterpart of /namalenia: every product on sale that can be bought now, biggest discount first.
const PATH = "/ro/reduceri";
const DESCRIPTION = "Toate ceasurile, bijuteriile și articolele din piele de crocodil Lorenzo Ricci aflate la reducere, ordonate după mărimea reducerii.";

export const metadata: Metadata = {
  title: "Reduceri",
  description: DESCRIPTION,
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: { "ro-RO": `https://lorenzo-ricci.com${PATH}`, "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}` },
  },
  openGraph: { type: "website", locale: "ro_RO", siteName: "Lorenzo Ricci", url: `https://lorenzo-ricci.com${PATH}`, title: "Reduceri | Lorenzo Ricci", description: DESCRIPTION },
};

// Re-checked every 5 minutes (sold-out list and prices), like the home page.
export const revalidate = 300;

export default async function RoSalePage() {
  const [overrides, soldOutSlugs] = await Promise.all([getPriceOverrides(), getSoldOutSlugs()]);
  const list = discountedProducts(applyOverrides(products.filter(roEligible), overrides), new Set(soldOutSlugs));
  const n = list.length;

  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="relative py-20 sm:py-28 px-5 sm:px-8 text-center bg-[#B3121F]">
        <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/70 mb-5">Lorenzo Ricci</p>
        <h1 className="font-serif text-display-lg text-white mb-5">Reduceri</h1>
        <div className="w-10 h-px bg-white/40 mx-auto my-5" />
        <p className="font-sans text-xs font-light text-white/80 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
          {n ? `${n} ${n === 1 ? "produs" : "produse"} · ordonate după reducere` : "Momentan nu există produse reduse"}
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-12">
        {n ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8" data-testid="sale-grid">
            {list.map((p, i) => (
              <div key={p.slug} data-slug={p.slug} data-discount={Math.round(discountPct(p))}>
                <RoProductCard product={localizeProduct(p)} priority={i < 2} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-ink-muted">Descoperiți toate <a className="underline" href="/ro/ceasuri">ceasurile</a> și <a className="underline" href="/ro/bijuterii">bijuteriile</a>.</p>
        )}
      </div>
    </div>
  );
}
