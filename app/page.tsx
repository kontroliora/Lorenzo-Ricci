import { Hero } from "@/components/home/Hero";
import { FeaturedWatches } from "@/components/home/FeaturedWatches";
import { WalletsSection } from "@/components/home/WalletsSection";
import { MilanoAvorioFlagship } from "@/components/home/MilanoAvorioFlagship";
import { JewellerySection } from "@/components/home/JewellerySection";
import { EditorialJewellery } from "@/components/home/EditorialJewellery";
import { BrandValues } from "@/components/home/BrandValues";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
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

export default async function HomePage() {
  const rawMilanoAvorio = getProductBySlug("bag-milano-avorio");
  const milanoAvorio = rawMilanoAvorio
    ? applyOverride(rawMilanoAvorio, await getPriceOverrides())
    : undefined;

  return (
    <>
      <Hero />
      <FeaturedWatches />
      <WalletsSection />
      {milanoAvorio && <MilanoAvorioFlagship product={milanoAvorio} />}
      <JewellerySection />
      <EditorialJewellery />
      <BrandValues />
      <TestimonialsSection />
      {/* <InstagramSection /> */}
    </>
  );
}
