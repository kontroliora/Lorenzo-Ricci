import { Hero } from "@/components/home/Hero";
import { heroGeneral, heroJewel, heroWatch } from "@/lib/hero";
import { heroFirstScript, type HeroSlideKey } from "@/lib/hero-source";
import { heroSourceCfg } from "@/lib/hero-source-server";
import { watchGiftActive } from "@/lib/watch-gift";
import { FeaturedWatches } from "@/components/home/FeaturedWatches";
import { WalletsSection } from "@/components/home/WalletsSection";
import { MilanoAvorioFlagship } from "@/components/home/MilanoAvorioFlagship";
import { JewellerySection } from "@/components/home/JewellerySection";
import { NewCollectionSection } from "@/components/home/NewCollectionSection";
import { homeCollectionPicks } from "@/lib/new-collection";
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

// The sale banner's label follows the date and its percentage the live prices / stock. Rebuilt hourly; a sell-out
// (lib/stock-pages.ts), a price change (admin discount route) and a campaign phase switch (/api/cron/campaign-phase)
// rebuild it at once.
export const revalidate = 3600;

export default async function HomePage() {
  const overrides = await getPriceOverrides();
  const rawMilanoAvorio = getProductBySlug("bag-milano-avorio");
  const milanoAvorio = rawMilanoAvorio ? applyOverride(rawMilanoAvorio, overrides) : undefined;

  // Sold-out products are left out of the home sections (stock-driven; their own pages still say "Изчерпан")
  const soldOut = await getSoldOutSlugs();
  // Hero: never a sold-out product - both slides are picked from live stock (lib/hero.ts).
  const soldOutSet = new Set(soldOut);

  // Sale banner (lib/sale-campaign.ts): biggest live discount among buyable products, rounded down to 5%, and the
  // campaign phase of today (Europe/Sofia). No discount, or a date outside every phase -> no banner.
  const salePct = maxDiscountRounded(applyOverrides(products, overrides), new Set(soldOut));
  const saleLabel = campaignLabel();

  // "Дамска колекция" (the 2026 collection): one row of 4 in the shop and in stock, showcase order (lib/new-collection.ts).
  const newPieces = homeCollectionPicks(applyOverrides(products, overrides), new Set(soldOut));

  // Hero: three slides from live stock; which comes first is decided per visitor by traffic source (lib/hero-source.ts).
  const general = heroGeneral(soldOutSet), jewel = heroJewel(soldOutSet), watch = heroWatch(soldOutSet);
  const avail = ([general && "general", jewel && "jewel", watch && "watch"] as const).filter(Boolean) as HeroSlideKey[];
  const heroSource = await heroSourceCfg(avail);

  return (
    <>
      {/* Runs before the hero is parsed: marks <html data-hero-first> so the right slide is the first thing painted */}
      <script dangerouslySetInnerHTML={{ __html: heroFirstScript(heroSource) }} />
      <Hero
        campaign={saleLabel && salePct >= 5 ? { label: saleLabel, pct: salePct } : null}
        general={general}
        jewel={jewel}
        watch={watch}
        watchGift={watchGiftActive()}
        source={heroSource}
      />
      {saleLabel && salePct >= 5 && <SaleBanner label={saleLabel} pct={salePct} />}
      {/* The new collection is the main campaign: right under the hero and the sale bar, above the watches and leather */}
      <NewCollectionSection pieces={newPieces} />
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
