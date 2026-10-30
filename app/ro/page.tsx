import type { Metadata } from "next";
import { RoHero } from "@/components/ro/home/RoHero";
import { RoFeaturedWatches } from "@/components/ro/home/RoFeaturedWatches";
import { RoLeatherSection } from "@/components/ro/home/RoLeatherSection";
import { RoMilanoAvorioFlagship } from "@/components/ro/home/RoMilanoAvorioFlagship";
import { RoJewellerySection } from "@/components/ro/home/RoJewellerySection";
import { RoEditorialJewellery } from "@/components/ro/home/RoEditorialJewellery";
import { RoBrandValues } from "@/components/ro/home/RoBrandValues";
import { RoTestimonialsSection } from "@/components/ro/home/RoTestimonialsSection";
import { toRoTile } from "@/components/ro/home/ro-home-utils";
import { pickRoTestimonials } from "@/components/ro/home/ro-testimonials";
import { products } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { soldOutLast } from "@/lib/sold-out-order";
import { localizeProduct } from "@/lib/ro/catalog";
import { campaignLabelRo, maxDiscountRounded } from "@/lib/sale-campaign";
import { roEligible, fmtRON, RO_FREE_SHIPPING_RON, RO_DELIVERY_DAYS } from "@/lib/ro/config";
import { RO_REVIEWS_NOTE } from "@/lib/ro/reviews-ro";

const TITLE = "Lorenzo Ricci - Ceasuri de lux, bijuterii și piele de crocodil";
const DESCRIPTION = `Ceasuri Lorenzo Ricci cu sticlă safir și mecanism japonez, bijuterii placate cu aur de 18K, portofele, port-carduri și clutch-uri din piele de crocodil. Livrare gratuită de la ${fmtRON(RO_FREE_SHIPPING_RON)}, în ${RO_DELIVERY_DAYS} zile lucrătoare.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ["Lorenzo Ricci", "ceasuri de lux", "cronograf", "sticlă safir", "bijuterii", "brățări", "coliere", "placare cu aur de 18K", "articole din piele de crocodil", "portofel piele de crocodil", "Yachting", "Chrono Black", "Golden Eclipse", "Polar Frost"],
  alternates: {
    canonical: "https://lorenzo-ricci.com/ro",
    languages: {
      "ro-RO": "https://lorenzo-ricci.com/ro",
      "bg-BG": "https://lorenzo-ricci.com/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Lorenzo Ricci",
    url: "https://lorenzo-ricci.com/ro",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// The crocodile bag with its own flagship section (like the Bulgarian home): kept out of the leather rows below.
const FLAGSHIP_SLUG = "bag-milano-avorio";
const LEATHER_CATEGORIES = new Set(["wallets", "cardholders", "bags"]);

// Durable price overrides (supabase/product_price_overrides.sql, read via lib/price-overrides.ts) are fetched ONCE and
// merged exactly like the Bulgarian pages do - the page stays statically generated (no cookies/headers); the admin
// discount route revalidates it. The Romanian eligibility filter runs on the catalogue BEFORE the overrides, so the set
// of products is the same RO_SLUGS list the order route validates against. Sections get the already-localized products
// as props (prices stay EUR in the props; the sections show lei with ronOf / ronOriginalOf, sale included). The leather
// and flagship sections only get the few fields they render, to keep the page payload small.
// Sold-out products are listed last (lib/sold-out-order.ts); the sold-out list is re-read every 5 minutes.
export const revalidate = 300;

export default async function RoHomePage() {
  const overrides = await getPriceOverrides();
  const catalog = applyOverrides(products.filter(roEligible), overrides).map(localizeProduct);
  // Sold-out products stay in the sections ("Stoc epuizat", greyed out) but come last (lib/sold-out-order.ts).
  const soldOut = new Set(await getSoldOutSlugs());
  const watches = soldOutLast(catalog.filter((p) => p.category === "watches"), (s) => soldOut.has(s));
  const leather = soldOutLast(catalog.filter((p) => LEATHER_CATEGORIES.has(p.category) && p.slug !== FLAGSHIP_SLUG), (s) => soldOut.has(s)).map(toRoTile);
  const flagshipProduct = catalog.find((p) => p.slug === FLAGSHIP_SLUG);
  const flagship = flagshipProduct ? toRoTile(flagshipProduct) : undefined;
  const testimonials = pickRoTestimonials();
  // Campaign hero (same phase config and 5% rule as the Bulgarian banner/hero): the discount is the biggest live one among the products sold in Romania.
  const salePct = maxDiscountRounded(catalog, soldOut);
  const saleLabel = campaignLabelRo();

  return (
    <>
      <RoHero campaign={saleLabel && salePct >= 5 ? { label: saleLabel, pct: salePct } : null} />
      <RoFeaturedWatches watches={watches} />
      <RoLeatherSection products={leather} />
      {flagship && <RoMilanoAvorioFlagship product={flagship} />}
      <RoJewellerySection />
      <RoEditorialJewellery />
      <RoBrandValues />
      {testimonials.length > 0 && <RoTestimonialsSection items={testimonials} note={RO_REVIEWS_NOTE} />}
    </>
  );
}
