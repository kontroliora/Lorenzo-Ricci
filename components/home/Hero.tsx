import { HeroCollectionSlide } from "@/components/home/HeroCollectionSlide";
import type { HeroJewel } from "@/lib/hero";

// Home hero (BG): ONE static slide, "Дамска колекция" (owner, 17.11.2026) - the necklace and the bracelet on a model, the title, the
// 1+1 line and the button to the collection. No slider: no other slides, no dots, no automatic switching, no swipe.
// The photos are picked from live stock (lib/hero.ts heroJewel: never a sold-out piece); if no pair is in stock the slide keeps the
// default photos (HOME_HERO_PHOTOS) rather than leaving the top of the page empty. It is the page's LCP, so it is fetched at once.
//
// The brand slide (watch + jewellery + leather) and the watch + cardholder slide are not drawn any more (the watches and the leather
// goods are off the shelf, lib/storefront.ts). Their code is in git history (before 17.11.2026) and their photos are untouched in
// public/; the helpers heroGeneral() / heroWatch() stay in lib/hero.ts, unused.
const FALLBACK_ALTS = { necklace: "Колие на модел, дамска колекция Lorenzo Ricci", bracelet: "Гривна на модел, дамска колекция Lorenzo Ricci" };

export function Hero({ jewel }: { jewel: HeroJewel | null }) {
  return (
    <section data-testid="hero" className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden bg-charcoal-deep">
      <HeroCollectionSlide
        active
        mounted
        priority
        photos={jewel ? { necklace: jewel.necklace, bracelet: jewel.bracelet } : undefined}
        tag="Lorenzo Ricci · 2026"
        title="Дамска колекция"
        badge="1+1 БЕЗПЛАТНО"
        line="Второто бижу е подарък"
        cta="Разгледай колекцията"
        href="/jewellery#damska-kolekcia"
        alts={jewel?.alts ?? FALLBACK_ALTS}
      />
    </section>
  );
}
