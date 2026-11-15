"use client";
import Image from "next/image";
import Link from "next/link";
import { HeroCollectionSlide, HeroDots, useHeroSlides } from "@/components/home/HeroCollectionSlide";
import type { HeroJewel, HeroWatch } from "@/lib/hero";
import { WATCH_GIFT_TEXT } from "@/lib/watch-gift";
import { ChristmasDeliveryLine } from "@/components/ui/ChristmasDeliveryLine";

// Home hero (BG), two slides (owner, 15.11.2026):
//   1. The women's collection (the page's LCP: its on-model photos load at once, at high priority).
//   2. The watch + the free crocodile cardholder: an in-stock Yachting next to the cardholder Onice, on the photo's own off-white,
//      so this slide is light with dark text. Mounted after the page has loaded; the two then alternate.
// Neither slide ever shows a sold-out product: app/page.tsx picks both from live stock (lib/hero.ts). Without an in-stock watch
// there is no watch slide; without an in-stock jewellery pair, slide 1 falls back to the watch slide alone.
//
// `campaign`: set while a campaign phase and a discount of at least 5% are live (lib/sale-campaign.ts) - its label ("Черен петък")
// is the watch slide's headline. `watchGift`: the "Часовник + кардхолдър" offer is running (lib/watch-gift.ts).
export function Hero({ campaign = null, jewel, watch, watchGift }: {
  campaign?: { label: string; pct: number } | null;
  jewel: HeroJewel | null;
  watch: HeroWatch | null;
  watchGift: boolean;
}) {
  const count = (jewel ? 1 : 0) + (watch ? 1 : 0);
  const { slide, setSlide, ready, setPaused, swipe } = useHeroSlides(Math.max(count, 1));
  const watchIndex = jewel ? 1 : 0;

  return (
    <section
      className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden bg-[#FCFCFC]"
      {...(count > 1 ? swipe : {})}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {jewel && (
        <HeroCollectionSlide
          active={slide === 0}
          mounted
          priority
          photos={{ necklace: jewel.necklace, bracelet: jewel.bracelet }}
          tag="Lorenzo Ricci · 2026"
          title="Дамска колекция"
          badge="1+1 БЕЗПЛАТНО"
          line="Второто бижу е подарък"
          cta="Разгледай колекцията"
          href="/jewellery#damska-kolekcia"
          alts={jewel.alts}
        />
      )}

      {watch && (
        <WatchSlide
          active={slide === watchIndex}
          mounted={!jewel || ready}
          priority={!jewel}
          watch={watch}
          headline={campaign?.label ?? null}
          line={watchGift ? WATCH_GIFT_TEXT.hero : campaign ? `До −${campaign.pct}% на часовници, бижута и крокодилска кожа` : "Прецизност във всеки детайл"}
        />
      )}

      {ready && count > 1 && (
        <HeroDots slide={slide} count={count} onSelect={setSlide} labels={[jewel ? "Дамска колекция" : "Часовници", "Часовници"]} dark={slide === watchIndex} />
      )}
    </section>
  );
}

/** Slide 2: light (#FCFCFC = how browsers draw the photo's own #FCFBFC background), the watch + cardholder image and dark text; image on the right on larger
 *  screens, above the text on phones. The image is shown whole (object-contain) - nothing of the watch or the cardholder is cut. */
function WatchSlide({ active, mounted, priority, watch, headline, line }: {
  active: boolean; mounted: boolean; priority: boolean; watch: HeroWatch; headline: string | null; line: string;
}) {
  if (!mounted) return null;
  const Title = priority ? "h1" : "h2";
  return (
    <div
      data-testid="hero-watch-slide"
      aria-hidden={!active}
      className={`absolute inset-0 z-[6] bg-[#FCFCFC] transition-opacity duration-1000 ${active ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="h-full max-w-7xl mx-auto px-5 sm:px-8 pt-[100px] sm:pt-[110px] pb-24 flex flex-col lg:flex-row-reverse items-center justify-center gap-6 lg:gap-12">
        <div className="relative w-full lg:w-[58%] aspect-[5/3] max-h-[42vh] lg:max-h-none">
          <Image src={watch.src} alt={watch.alt} fill priority={priority} quality={97} sizes="(max-width: 1023px) 100vw, 740px" className="object-contain" />
        </div>
        <div className="w-full lg:w-[42%] text-center lg:text-left">
          <p className="font-sans text-[10px] font-medium tracking-[0.32em] uppercase text-ink-muted mb-4 sm:mb-5">Часовници Yachting</p>
          <Title className="font-serif text-display-lg sm:text-display-xl text-navy mb-4 text-balance">
            {headline ?? <>Създадени да <em className="not-italic">впечатляват</em></>}
          </Title>
          <p className="font-sans text-xs sm:text-sm font-medium text-charcoal tracking-[0.14em] uppercase leading-relaxed mb-8 sm:mb-10 max-w-md mx-auto lg:mx-0">
            {line}
          </p>
          {/* 01.12-21.12 only (lib/christmas-delivery.ts) */}
          <ChristmasDeliveryLine className="-mt-5 sm:-mt-6 mb-7 sm:mb-8 font-sans text-[11px] sm:text-xs font-medium text-[#2E6B3F] tracking-[0.14em] uppercase" />
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
            <Link href="/watches" tabIndex={active ? 0 : -1} className="btn-primary min-w-[200px] text-center" data-testid="hero-watch-cta">
              Виж часовниците
            </Link>
            <Link href="/namalenia" tabIndex={active ? 0 : -1} className="btn-outline min-w-[200px] text-center">
              Виж намаленията
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
