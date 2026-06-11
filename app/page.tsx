import { Hero } from "@/components/home/Hero";
import { FeaturedWatches } from "@/components/home/FeaturedWatches";
import { WalletsSection } from "@/components/home/WalletsSection";
import { JewellerySection } from "@/components/home/JewellerySection";
import { EditorialJewellery } from "@/components/home/EditorialJewellery";
import { BrandValues } from "@/components/home/BrandValues";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
// import { InstagramSection } from "@/components/home/InstagramSection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedWatches />
      <WalletsSection />
      <JewellerySection />
      <EditorialJewellery />
      <BrandValues />
      <TestimonialsSection />
      {/* <InstagramSection /> */}
    </>
  );
}
