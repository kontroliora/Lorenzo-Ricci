import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import type { Metadata } from "next";
import { BUNDLES, bundleHasSaleItem } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { localizeProduct } from "@/lib/ro/catalog";
import { ronOf, ronOriginalOf, roNeedsPrepayment } from "@/lib/ro/config";
import { RO_BUNDLE_LABEL } from "@/lib/ro/bundles-ro";
import { roBundleDiscount } from "@/lib/ro/pricing";
import { roToBgPath } from "@/lib/ro/route-map";
import { roDisplayName, roSafeText } from "@/components/ro/listing/ro-display";
import { RoBundlesClient, type RoBundleCardData, type RoBundlePiece } from "@/components/ro/bundles/RoBundlesClient";

const PATH = "/ro/seturi";

const DESCRIPTION =
  "Completați ținuta cu seturi selectate de bijuterii Lorenzo Ricci. Combinați o brățară și un colier din aceeași colecție și primiți 10% reducere.";

export const metadata: Metadata = {
  title: "Seturi",
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "seturi de bijuterii", "set brățară și colier", "reducere set"],
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: { "ro-RO": `https://lorenzo-ricci.com${PATH}`, "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}` },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: `https://lorenzo-ricci.com${PATH}`,
    title: "Seturi | Lorenzo Ricci",
    description: DESCRIPTION,
  },
};

// Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts) - the page stays
// statically generated; the admin discount route revalidates it. Same rules as the Bulgarian page: bundleHasSaleItem sees
// the SAME (overridden) prices that are shown below, so a set with a just-discounted piece is hidden (no stacking).
export default async function RoBundlesPage() {
  const overrides = await getPriceOverrides();
  const findProduct = (slug: string) => {
    const p = getProductBySlug(slug);
    return p ? applyOverride(p, overrides) : undefined;
  };

  const bundles: RoBundleCardData[] = BUNDLES.flatMap((bundle) => {
    const label = RO_BUNDLE_LABEL[bundle.id];
    // Each slot is filled by its first product that exists in the catalogue (all of them are sold in Romania).
    const found = bundle.slots.map((slot) => slot.map(findProduct).find((p) => p !== undefined));
    if (!label || found.some((p) => !p)) return [];
    // A set with a sale item earns no set discount (no stacking) - don't advertise it.
    if (bundleHasSaleItem(bundle, findProduct)) return [];

    const pieces: RoBundlePiece[] = found.map((p) => {
      const product = localizeProduct(p!);
      const name = roDisplayName(product);
      const originalRon = ronOriginalOf(p!);
      return {
        slug: product.slug,
        sku: product.sku,
        name,
        ron: ronOf(p!),
        originalRon,
        onSale: originalRon !== undefined,
        prepay: roNeedsPrepayment(p!),
        image: product.coverImage.src,
        imageAlt: roSafeText(product.coverImage.alt, name),
      };
    });

    // The set discount comes from the very function the cart and /api/order-ro use.
    const { totalDiscount } = roBundleDiscount(pieces.map((p) => ({ slug: p.slug, ron: p.ron, quantity: 1, onSale: p.onSale })));

    // Which products may fill a slot, and whether the catalogue has them switched on (live stock is read in the browser).
    const inStock: Record<string, boolean> = {};
    for (const slot of bundle.slots) for (const slug of slot) inStock[slug] = getProductBySlug(slug)?.inStock === true;

    return [{ id: bundle.id, label, pieces, discountPct: bundle.discountPct, discountRon: totalDiscount, slots: bundle.slots, inStock }];
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
          <h1 className="font-serif text-display-lg text-white mb-5">Seturi</h1>
          <div className="w-10 h-px bg-white/20 mx-auto my-5" />
          <p className="font-sans text-xs font-light text-white/45 max-w-md mx-auto leading-relaxed tracking-widest uppercase">
            Completați ținuta · -10% la cumpărarea setului
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-16">
        {/* Section intro */}
        <div className="text-center mb-14">
          <p className="section-tag mb-4">Combinații selectate</p>
          <h2 className="section-title mb-4">Combinația perfectă</h2>
          <div className="gold-divider" />
          <p className="font-sans text-sm font-light text-ink-muted max-w-lg mx-auto mt-6 leading-relaxed tracking-wide">
            Combinați o brățară și un colier din aceeași colecție și economisiți 10% din prețul setului.
            Reducerea se aplică automat în coș.
          </p>
        </div>

        {/* Bundle cards */}
        {bundles.length > 0 ? (
          <RoBundlesClient bundles={bundles} />
        ) : (
          <p className="text-center font-sans text-sm font-light text-ink-muted tracking-wide">
            Momentan nu există seturi disponibile.
          </p>
        )}

        {/* Trust strip */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-0 border border-border">
          {[
            { title: "Reducere automată",   sub: "Se aplică direct în coș" },
            CARD_PAYMENTS_ENABLED ? { title: "Card sau ramburs", sub: "Plată online securizată prin Stripe" } : { title: "Plata ramburs", sub: "Achitați la primirea coletului" },
            { title: "Garanție pe viață",    sub: "La toate bijuteriile" },
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
