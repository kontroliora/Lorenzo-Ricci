import { Hero } from "@/components/home/Hero";
import { FeaturedWatches } from "@/components/home/FeaturedWatches";
import { WalletsSection } from "@/components/home/WalletsSection";
import { MilanoAvorioFlagship } from "@/components/home/MilanoAvorioFlagship";
import { JewellerySection } from "@/components/home/JewellerySection";
import { EditorialJewellery } from "@/components/home/EditorialJewellery";
import { BrandValues } from "@/components/home/BrandValues";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { getProductBySlug } from "@/lib/products";
// import { InstagramSection } from "@/components/home/InstagramSection";

export default function HomePage() {
  const milanoAvorio = getProductBySlug("bag-milano-avorio");

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
