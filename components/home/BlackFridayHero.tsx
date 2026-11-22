"use client";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BLACK_FRIDAY_COUNTDOWN as BF, BLACK_FRIDAY_END_MS } from "@/lib/black-friday-countdown";
import { SaleCountdown } from "@/components/product/SaleCountdown";

// Home hero during Black Friday (owner, 23.11.2026): the clover necklace + bracelet in the Lorenzo Ricci box on black, the text in the
// black left half. Same fixed end moment as the top strip (lib/black-friday-countdown.ts). After it, `fallback` (the usual
// "Дамска колекция" hero, components/home/Hero.tsx, untouched) is drawn instead:
//   - the page is rebuilt hourly (app/page.tsx revalidate) and the server then renders only the usual hero;
//   - on a page built before the end, html.bf-off (pre-paint check in app/layout.tsx) hides this hero before first paint
//     (app/globals.css .bf-hero) and the timer below swaps in the fallback after load.
// The photo (public/hero-black-friday.webp, 1920x1072) has a visible edge at ~45% of its width where the pure black meets the
// lighter backdrop; a black -> transparent gradient laid over the PHOTO (not the screen: the box below has the photo's own size)
// hides it. Box geometry + gradient per screen: app/globals.css .bf-hero-img.

export function BlackFridayHero({ fallback }: { fallback: ReactNode }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!BF.enabled || Date.now() > BLACK_FRIDAY_END_MS) return setOver(true);
    const id = setTimeout(() => setOver(true), Math.min(BLACK_FRIDAY_END_MS - Date.now() + 1000, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, []);

  if (over) return <>{fallback}</>;

  return (
    <section
      data-testid="hero"
      className="bf-hero relative w-full h-screen min-h-[600px] max-h-[1000px] overflow-hidden bg-black [container-type:size]"
    >
      <div className="bf-hero-img absolute">
        <Image
          src="/hero-black-friday.webp"
          alt="Колие и гривна с детелина в кутия Lorenzo Ricci"
          fill
          priority
          sizes="(max-width: 639px) 240vw, 100vw"
          className="object-cover"
        />
        <div aria-hidden className="bf-hero-fade absolute inset-0" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-start sm:justify-center px-6 sm:px-[6vw] pt-[128px] sm:pt-[96px]">
        <div className="max-w-[520px] sm:max-w-[46%] text-left">
          <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/60 mb-4 sm:mb-6">
            Lorenzo Ricci · Черен петък
          </p>
          <h1 className="font-serif text-display-xl text-white mb-4 sm:mb-5 sm:whitespace-nowrap">Черен петък</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-sm sm:text-base font-light text-white/85 tracking-widest uppercase">
            <span className="font-sans text-[11px] sm:text-xs font-semibold tracking-[0.16em] bg-[#B3121F] text-white px-2.5 py-1">
              1+1 БЕЗПЛАТНО
            </span>
            <span>Второто бижу е подарък</span>
          </p>
          <SaleCountdown label={BF.label.hero} className="mt-4 sm:mt-5 justify-start" />
          <Link href="/jewellery#damska-kolekcia" className="btn-primary min-w-[220px] mt-6 sm:mt-9" data-testid="hero-bf-cta">
            Виж офертата
          </Link>
        </div>
      </div>
    </section>
  );
}
