import type { Metadata } from "next";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { soldOutLast } from "@/lib/sold-out-order";
import { Suspense } from "react";
import { getBracelets, getNecklaces } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { localizeProduct } from "@/lib/ro/catalog";
import { roToBgPath } from "@/lib/ro/route-map";
import { RoJewelleryPageClient } from "@/components/ro/listing/RoJewelleryPageClient";

const PATH = "/ro/bijuterii";

// Same claims as the Bulgarian page: 4-layer 18K PVD plating, hypoallergenic, water resistant, lifetime warranty.
const DESCRIPTION =
  "Bijuterii Lorenzo Ricci - brățări și coliere cu acoperire PVD din aur 18K în 4 straturi. Hipoalergenice, rezistente la apă. Garanție pe viață.";

export const metadata: Metadata = {
  title: "Bijuterii",
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "bijuterii", "brățări", "coliere", "aur 18K PVD", "bijuterii hipoalergenice", "garanție pe viață"],
  alternates: {
    canonical: `https://lorenzo-ricci.com${PATH}`,
    languages: { "ro-RO": `https://lorenzo-ricci.com${PATH}`, "bg-BG": `https://lorenzo-ricci.com${roToBgPath(PATH)}` },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: `https://lorenzo-ricci.com${PATH}`,
    title: "Bijuterii | Lorenzo Ricci",
    description: DESCRIPTION,
  },
};

// RoJewelleryPageClient is "use client" (category tabs read ?category=), so the server-side price merge happens here and the
// lists go down as props. Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts):
// the page stays statically generated; the admin discount route revalidates it.
// Sold-out products are listed last (lib/sold-out-order.ts); the sold-out list is re-read every 5 minutes.
export const revalidate = 300;

export default async function RoJewelleryPage() {
  const overrides = await getPriceOverrides();
  const soldOut = new Set(await getSoldOutSlugs());
  const bracelets = soldOutLast(applyOverrides(getBracelets(), overrides).map(localizeProduct), (s) => soldOut.has(s));
  const necklaces = soldOutLast(applyOverrides(getNecklaces(), overrides).map(localizeProduct), (s) => soldOut.has(s));

  return (
    <Suspense>
      <RoJewelleryPageClient bracelets={bracelets} necklaces={necklaces} />
    </Suspense>
  );
}
