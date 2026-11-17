"use client";
import Image from "next/image";
import Link from "next/link";
import { HOME_HERO_PHOTOS } from "@/lib/new-collection";

// The slide photos fill a full-screen box (object-cover): cropped and drawn larger than the box, so a resized copy looked a touch
// softer than the original (checked side by side, 08.11.2026). They always get the original; the slide mounts after load anyway.
const COVER_SLIDE_SIZES = "2048px";

// The home hero's collection slide (BG + RO): the page's only hero slide (owner, 17.11.2026) - no slider, no dots, no automatic switching.
// BG: the page's LCP (priority, photos chosen from live stock in lib/hero.ts); RO: the default photos. Phones: the necklace on the
// neck, full screen; larger screens: necklace + bracelet on model side by side.

export function HeroCollectionSlide({ active, mounted, tag, title, badge, line, cta, href, alts, photos = HOME_HERO_PHOTOS, priority = false }: {
  active: boolean; mounted: boolean; tag: string; title: string; badge: string; line: string; cta: string; href: string;
  alts: { necklace: string; bracelet: string };
  /** The two on-model photos (BG: chosen from live stock, lib/hero.ts); RO keeps the default pair. */
  photos?: { necklace: string; bracelet: string };
  /** BG: this is the first slide and the page's LCP - fetched at once, at high priority. */
  priority?: boolean;
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
          <Image src={photos.necklace} alt={alts.necklace} fill sizes={COVER_SLIDE_SIZES} quality={80} priority={priority} className="object-cover object-center" />
        </div>
        <div className="relative hidden sm:block">
          <Image src={photos.bracelet} alt={alts.bracelet} fill sizes={COVER_SLIDE_SIZES} quality={80} priority={priority} className="object-cover object-center" />
        </div>
      </div>
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 drop-shadow-lg">
        <p className="font-sans text-[10px] font-light tracking-[0.32em] uppercase text-white/70 mb-6">{tag}</p>
        {priority ? <h1 className="font-serif text-display-xl text-white mb-5 text-balance">{title}</h1> : <h2 className="font-serif text-display-xl text-white mb-5 text-balance">{title}</h2>}
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
