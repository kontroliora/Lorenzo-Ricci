import { Hero } from "@/components/home/Hero";
import { FeaturedWatches } from "@/components/home/FeaturedWatches";
import { WalletsSection } from "@/components/home/WalletsSection";
import { MilanoAvorioFlagship } from "@/components/home/MilanoAvorioFlagship";
import { JewellerySection } from "@/components/home/JewellerySection";
import { EditorialJewellery } from "@/components/home/EditorialJewellery";
import { BrandValues } from "@/components/home/BrandValues";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { getProductBySlug, products } from "@/lib/products";
import { SaleBanner } from "@/components/home/SaleBanner";
import { campaignLabel, maxDiscountRounded } from "@/lib/sale-campaign";
import { getPriceOverrides, applyOverride, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
// import { InstagramSection } from "@/components/home/InstagramSection";

// Durable price overrides (supabase/product_price_overrides.sql, read via
// lib/price-overrides.ts) for the Milano Avorio flagship section below — page
// stays statically generated; the admin discount route calls revalidatePath("/")
// on every write.
//
// Note: FeaturedWatches and WalletsSection (rendered below) are "use client" and
// call getWatches()/getProductBySlug themselves in the browser bundle — like
// ProductInfo's sibling-swatch lookup, they're outside this merge point and keep
// showing the plain catalog price. Only the Milano Avorio flagship (fed a `product`
// prop from here) picks up an override on the homepage.

// The sale banner's label follows the date and its percentage the live prices / stock: re-render at least every 5 minutes.
export const revalidate = 300;

export default async function HomePage() {
  const overrides = await getPriceOverrides();
  const rawMilanoAvorio = getProductBySlug("bag-milano-avorio");
  const milanoAvorio = rawMilanoAvorio ? applyOverride(rawMilanoAvorio, overrides) : undefined;

  // Sold-out products are left out of the home sections (stock-driven; their own pages still say "Изчерпан")
  const soldOut = await getSoldOutSlugs();

  // Sale banner (lib/sale-campaign.ts): biggest live discount among buyable products, rounded down to 5%, and the
  // campaign phase of today (Europe/Sofia). No discount, or a date outside every phase -> no banner.
  const salePct = maxDiscountRounded(applyOverrides(products, overrides), new Set(soldOut));
  const saleLabel = campaignLabel();

  return (
    <>
      <Hero />
      {saleLabel && salePct >= 5 && <SaleBanner label={saleLabel} pct={salePct} />}
      <FeaturedWatches soldOut={soldOut} />
      <WalletsSection soldOut={soldOut} />
      {milanoAvorio && <MilanoAvorioFlagship product={milanoAvorio} />}
      <JewellerySection />
      <EditorialJewellery />
      <BrandValues />
      <TestimonialsSection />
      {/* <InstagramSection /> */}
    </>
  );
}
