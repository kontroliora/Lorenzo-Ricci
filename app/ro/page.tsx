import type { Metadata } from "next";
import { RoHero } from "@/components/ro/home/RoHero";
import { RoFeaturedWatches } from "@/components/ro/home/RoFeaturedWatches";
import { RoLeatherSection } from "@/components/ro/home/RoLeatherSection";
import { RoBrandValues } from "@/components/ro/home/RoBrandValues";
import { products } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { localizeProduct } from "@/lib/ro/catalog";
import { roEligible } from "@/lib/ro/config";
import { fmtRON, RO_FREE_SHIPPING_RON } from "@/lib/ro/config";

const TITLE = "Lorenzo Ricci - Ceasuri de lux și articole din piele de crocodil";
const DESCRIPTION = `Ceasuri Lorenzo Ricci cu sticlă safir și mecanism japonez, portofele, port-carduri și clutch-uri din piele de crocodil. Plata la livrare (ramburs), livrare gratuită peste ${fmtRON(RO_FREE_SHIPPING_RON)}.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "ceasuri de lux", "cronograf", "sticlă safir", "articole din piele de crocodil", "portofel piele de crocodil", "Yachting", "Chrono Black", "Golden Eclipse", "Polar Frost"],
  alternates: { canonical: "https://lorenzo-ricci.com/ro" },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: "https://lorenzo-ricci.com/ro",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts) merged exactly like
// the Bulgarian pages do - the page stays statically generated (no cookies/headers); the admin discount route
// revalidates it. The Romanian eligibility filter runs on the catalogue BEFORE the overrides, so the set of products
// is the same RO_SLUGS list the order route validates against.
export default async function RoHomePage() {
  const overrides = await getPriceOverrides();
  const catalog = applyOverrides(products.filter(roEligible), overrides).map(localizeProduct);
  const watches = catalog.filter((p) => p.category === "watches");
  const leather = catalog.filter((p) => p.category !== "watches");

  return (
    <>
      <RoHero />
      <RoFeaturedWatches watches={watches} />
      <RoLeatherSection products={leather} />
      <RoBrandValues />
    </>
  );
}
