"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HOME_HERO_PHOTOS } from "@/lib/new-collection";

// The home hero's second slide (BG + RO): the new collection. The watch slide stays first and is the page's LCP, so this one is
// mounted only after the page has loaded (its photos never compete with the cover) and the two then alternate. Phones: the
// necklace on the neck, full screen; larger screens: necklace + bracelet on model side by side.

export const HERO_SLIDE_MS = 6500;

/**
 * Slide rotation: 0 = the watch slide, 1 = the new collection. Starts after the page has loaded; pauses while the tab is hidden;
 * no automatic rotation for people who asked for less motion (the dots still switch). Swipe on touch screens.
 */
export function useHeroSlides(count = 2) {
  const [slide, setSlide] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const go = () => setReady(true);
    if (document.readyState === "complete") { const t = setTimeout(go, 400); return () => clearTimeout(t); }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  useEffect(() => {
    if (!ready || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!document.hidden) setSlide((s) => (s + 1) % count); }, HERO_SLIDE_MS);
    return () => clearInterval(t);
  }, [ready, paused, count, slide]);

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null;
      if (Math.abs(dx) > 50) setSlide((s) => (s + (dx < 0 ? 1 : count - 1)) % count);
    },
  };
  return { slide, setSlide, ready, setPaused, swipe };
}

export function HeroDots({ slide, count = 2, onSelect, labels }: { slide: number; count?: number; onSelect: (i: number) => void; labels: string[] }) {
  return (
    <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-3" role="tablist">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={slide === i}
          aria-label={labels[i]}
          onClick={() => onSelect(i)}
          className="p-2 -m-2"
        >
          <span className={`block h-[3px] transition-all duration-500 ${slide === i ? "w-8 bg-white" : "w-4 bg-white/45"}`} />
        </button>
      ))}
    </div>
  );
}

export function HeroCollectionSlide({ active, mounted, tag, title, badge, line, cta, href, alts }: {
  active: boolean; mounted: boolean; tag: string; title: string; badge: string; line: string; cta: string; href: string;
  alts: { necklace: string; bracelet: string };
}) {
  if (!mounted) return null;
  return (
    <div
      data-testid="hero-collection-slide"
      aria-hidden={!active}
      className={`absolute inset-0 z-[5] transition-opacity duration-1000 ${active ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="absolute inset-0 grid grid-cols-1 sm:grid-cols-2">
        <div className="relative">
          <Image src={HOME_HERO_PHOTOS.necklace} alt={alts.necklace} fill sizes="(max-width: 640px) 100vw, 50vw" quality={80} className="object-cover object-center" />
        </div>
        <div className="relative hidden sm:block">
          <Image src={HOME_HERO_PHOTOS.bracelet} alt={alts.bracelet} fill sizes="50vw" quality={80} className="object-cover object-center" />
        </div>
      </div>
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 drop-shadow-lg">
        <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/70 mb-6">{tag}</p>
        <h2 className="font-serif text-display-xl text-white mb-5 text-balance">{title}</h2>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mb-10 font-sans text-sm sm:text-base font-light text-white/85 tracking-widest uppercase">
          <span className="font-sans text-[11px] sm:text-xs font-semibold tracking-[0.16em] bg-[#B3121F] text-white px-2.5 py-1">{badge}</span>
          <span>{line}</span>
        </p>
        <Link href={href} tabIndex={active ? 0 : -1} className="btn-primary min-w-[220px]" data-testid="hero-collection-cta">
          {cta}
        </Link>
      </div>
    </div>
  );
}
