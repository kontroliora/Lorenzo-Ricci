"use client";
import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { HeroCollectionSlide, HeroDots, useHeroSlides } from "@/components/home/HeroCollectionSlide";
import type { HeroGeneral, HeroJewel, HeroWatch } from "@/lib/hero";
import { decideHeroFirst, type HeroSlideKey, type HeroSourceCfg } from "@/lib/hero-source";
import { WATCH_GIFT_TEXT } from "@/lib/watch-gift";
import { ChristmasDeliveryLine } from "@/components/ui/ChristmasDeliveryLine";

// Home hero (BG), three slides (owner, 15.11.2026). Which one comes FIRST depends on where the visitor came from (lib/hero-source.ts):
// a jewellery ad -> "Дамска колекция", a watch ad -> the watch + cardholder slide, everyone else -> the general brand slide. The
// others follow in the default order (general, jewellery, watch); the order is kept for the whole visit (sessionStorage).
//
// First paint: the page is static, so the server renders the default order and an inline script (app/page.tsx) marks
// <html data-hero-first> before the hero is parsed; while the section carries data-hero-pending, globals.css shows only that slide.
// After hydration the component takes over with the same decision. The other slides stay display:none until the page has loaded
// (their photos are lazy, so a visitor first downloads only the slide they see).
//
// No slide ever shows a sold-out product: app/page.tsx picks every product from live stock (lib/hero.ts).
const LABELS: Record<HeroSlideKey, string> = { general: "Lorenzo Ricci", jewel: "Дамска колекция", watch: "Часовници" };

export function Hero({ campaign = null, general, jewel, watch, watchGift, source }: {
  campaign?: { label: string; pct: number } | null;
  general: HeroGeneral | null;
  jewel: HeroJewel | null;
  watch: HeroWatch | null;
  watchGift: boolean;
  source: HeroSourceCfg;
}) {
  const keys = source.avail;
  const [first, setFirst] = useState<HeroSlideKey | null>(null); // null = not decided in React yet (server render, first client render)
  useLayoutEffect(() => { setFirst(decideHeroFirst(source)); }, [source]);
  const order: HeroSlideKey[] = first ? [first, ...keys.filter((k) => k !== first)] : keys;
  const count = Math.max(order.length, 1);
  const { slide, setSlide, ready, setPaused, swipe } = useHeroSlides(count);
  const pending = first === null;
  const activeKey = order[slide];
  const shown = (k: HeroSlideKey) => pending || ready || k === order[0];
  const wrap = (k: HeroSlideKey, node: React.ReactNode) => (
    <div data-hero-slide={k} className={`absolute inset-0 ${shown(k) ? "" : "hidden"}`}>{node}</div>
  );
  const headline = campaign?.label ?? null;

  return (
    <section
      className="relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden bg-[#FCFCFC]"
      data-hero-pending={pending ? "" : undefined}
      {...(count > 1 ? swipe : {})}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {general && wrap("general",
        <GeneralSlide active={activeKey === "general"} general={general} headline={headline} priority />,
      )}

      {jewel && wrap("jewel",
        <HeroCollectionSlide
          active={activeKey === "jewel"}
          mounted
          priority={!general}
          photos={{ necklace: jewel.necklace, bracelet: jewel.bracelet }}
          tag="Lorenzo Ricci · 2026"
          title="Дамска колекция"
          badge="1+1 БЕЗПЛАТНО"
          line="Второто бижу е подарък"
          cta="Разгледай колекцията"
          href="/jewellery#damska-kolekcia"
          alts={jewel.alts}
        />,
      )}

      {watch && wrap("watch",
        <WatchSlide
          active={activeKey === "watch"}
          priority={!general && !jewel}
          watch={watch}
          headline={headline}
          line={watchGift ? WATCH_GIFT_TEXT.hero : campaign ? `До −${campaign.pct}% на часовници, бижута и крокодилска кожа` : "Прецизност във всеки детайл"}
        />,
      )}

      {ready && count > 1 && (
        <HeroDots slide={slide} count={count} onSelect={setSlide} labels={order.map((k) => LABELS[k])} dark={activeKey !== "jewel"} />
      )}
    </section>
  );
}

// Soft edges for the product photos (pct = width of the fade at each side; the products sit well inside it).
const edgeFade = (pct: number): React.CSSProperties => {
  const g = `linear-gradient(to right, transparent, #000 ${pct}%, #000 ${100 - pct}%, transparent), linear-gradient(to bottom, transparent, #000 ${pct}%, #000 ${100 - pct}%, transparent)`;
  return { maskImage: g, WebkitMaskImage: g, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
};
const EDGE_FADE = edgeFade(7), EDGE_FADE_WIDE = edgeFade(14); // the cardholders' backdrop is uneven (249-253): a wider fade

const fade = (active: boolean) => `absolute inset-0 transition-opacity duration-1000 ${active ? "opacity-100" : "opacity-0 pointer-events-none"}`;

/** General brand slide: light (#FCFCFC, the cardholders' own backdrop), a watch + a jewellery piece + a crocodile-leather piece side by side, three buttons. */
function GeneralSlide({ active, general, headline, priority }: { active: boolean; general: HeroGeneral; headline: string | null; priority: boolean }) {
  const Title = priority ? "h1" : "h2";
  const BTN = "!px-1 text-center max-sm:!tracking-[0.12em] max-sm:!text-[11px]";
  // Box widths (share of the row); the watch cutout has wide empty sides, so its neighbours overlap them a little.
  const BOX: Record<string, string> = { watch: "w-[42%] -mr-[5%] z-[1]", jewel: "w-[34%]", leather: "w-[34%] -ml-[5%]" };
  return (
    <div data-testid="hero-general-slide" aria-hidden={!active} className={`${fade(active)} z-[7] bg-[#FCFCFC]`}>
      <div className="h-full max-w-7xl mx-auto px-5 sm:px-8 pt-[100px] sm:pt-[110px] pb-24 flex flex-col lg:flex-row-reverse items-center justify-center gap-4 lg:gap-10">
        <div className="relative w-[calc(100%+40px)] -mx-5 sm:mx-0 sm:w-full lg:w-[60%] aspect-[16/9] max-h-[40vh] lg:max-h-none flex items-center justify-center">
          {general.items.map((it) => (
            <div key={it.slug} className={`relative aspect-square ${BOX[it.kind]}`}>
              {/* The product photos' own near-white backdrops (248-255) fade into the slide's white at their edges: no visible box */}
              {/* Pure-white backdrops (the bracelets' photo no. 1, the wallets) multiply into the slide's #FCFCFC; the cardholders' own
                  backdrop already is #FCFCFC, so they are drawn as they are. */}
              <Image src={it.src} alt={it.alt} fill priority={priority} quality={97} sizes="(max-width: 1023px) 45vw, 330px"
                className={`object-contain ${it.kind === "jewel" || it.slug.startsWith("wallet-") ? "mix-blend-multiply" : ""}`}
                style={it.kind === "watch" ? undefined : it.slug.startsWith("cardholder-") ? EDGE_FADE_WIDE : EDGE_FADE} />
            </div>
          ))}
        </div>
        <div className="w-full lg:w-[40%] text-center lg:text-left">
          <p className="font-sans text-[10px] font-medium tracking-[0.32em] uppercase text-ink-muted mb-4 sm:mb-5">Lorenzo Ricci</p>
          <Title className="font-serif text-display-lg sm:text-display-xl text-navy mb-4 text-balance">
            {headline ?? "Lorenzo Ricci"}
          </Title>
          <p className="font-sans text-xs sm:text-sm font-medium text-charcoal tracking-[0.14em] uppercase leading-relaxed mb-8 sm:mb-10">
            Часовници · Бижута · Крокодилска кожа
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto lg:mx-0">
            <Link href="/watches" tabIndex={active ? 0 : -1} className={`btn-primary ${BTN}`} data-testid="hero-general-cta">Часовници</Link>
            <Link href="/jewellery" tabIndex={active ? 0 : -1} className={`btn-outline ${BTN}`}>Бижута</Link>
            <Link href="/leather-goods" tabIndex={active ? 0 : -1} className={`btn-outline ${BTN}`}>Кожа</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Watch + gift slide: light (#FCFCFC = how browsers draw the photo's own #FCFBFC background), the watch + cardholder image and dark
 *  text; image on the right on larger screens, above the text on phones. The image is shown whole (object-contain). */
function WatchSlide({ active, priority, watch, headline, line }: {
  active: boolean; priority: boolean; watch: HeroWatch; headline: string | null; line: string;
}) {
  const Title = priority ? "h1" : "h2";
  return (
    <div data-testid="hero-watch-slide" aria-hidden={!active} className={`${fade(active)} z-[6] bg-[#FCFCFC]`}>
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
