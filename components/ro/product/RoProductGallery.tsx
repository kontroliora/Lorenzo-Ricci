"use client";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useGallerySwipe } from "@/lib/use-gallery-swipe";
import type { ProductImage } from "@/lib/types";
import { smallVariant, smallOrOriginal } from "@/lib/image-variant";

interface RoProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function RoProductGallery({ images, productName }: RoProductGalleryProps) {
  // The photo index belongs to one product: switching to a sibling product (colour / type / stone) starts at its photo 1 in the
  // same render, with no frame of the old index on the new photos.
  const galleryKey = images[0]?.src ?? "";
  const [idxState, setIdxState] = useState({ key: galleryKey, idx: 0 });
  const activeIdx = idxState.key === galleryKey ? idxState.idx : 0;
  const setActiveIdx = useCallback((f: number | ((i: number) => number)) => {
    setIdxState((s) => {
      const cur = s.key === galleryKey ? s.idx : 0;
      return { key: galleryKey, idx: typeof f === "function" ? f(cur) : f };
    });
  }, [galleryKey]);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  // The photos next to the visible one are loaded ahead, so a swipe never shows an empty box.
  const n = images.length;
  const near = (i: number) => n <= 1 || i === activeIdx || i === (activeIdx + 1) % n || i === (activeIdx - 1 + n) % n;

  const active = images[activeIdx];

  const handleError = (idx: number) => {
    setImageError((prev) => ({ ...prev, [idx]: true }));
  };

  const prev = () => setActiveIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setActiveIdx((i) => (i + 1) % images.length);

  // Swipe left/right on the main image changes the photo (phones); a vertical drag still scrolls the page, and a horizontal one
  // locks the page so it cannot drift (lib/use-gallery-swipe.ts).
  const onSwipe = useCallback((d: "next" | "prev") => {
    setActiveIdx((i) => (i + (d === "next" ? 1 : -1) + n) % n);
  }, [n, setActiveIdx]);
  useGallerySwipe(box, onSwipe);

  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
      {/* Thumbnails */}
      <div className="flex flex-row sm:flex-col gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-y-auto sm:max-h-[600px] pb-1 sm:pb-0 flex-shrink-0">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`relative flex-shrink-0 w-16 h-16 overflow-hidden transition-all duration-200 bg-white ${
              activeIdx === i
                ? "border border-navy"
                : "border border-border hover:border-navy/40"
            }`}
            aria-label={img.alt}
          >
            <Image
              src={imageError[i] ? "/covers/desktop%20cover.webp" : smallOrOriginal(img.src)}
              alt={img.alt}
              fill
              quality={60}
              sizes="64px"
              className="object-contain object-center p-1"
              onError={() => handleError(i)}
            />
          </button>
        ))}
      </div>

      {/* Main image - flex-1 takes remaining width; inner div enforces square */}
      <div className="flex-1 min-w-0 w-full sm:w-auto sm:self-start">
      <div
        className="relative w-full aspect-square overflow-hidden bg-white border border-border touch-pan-y"
        ref={box}
      >
        {/* All gallery images pre-rendered and stacked.
            The browser fetches every image on page load; switching is a CSS opacity
            toggle with zero network latency. */}
        {/* First photo: preload the copy each screen will use (800 px on phones, the original above 640 px) */}
        {images[0] && smallVariant(images[0].src) && !imageError[0] && (
          <>
            <link rel="preload" as="image" href={smallVariant(images[0].src)} media="(max-width: 640px)" fetchPriority="high" />
            <link rel="preload" as="image" href={images[0].src} media="(min-width: 641px)" fetchPriority="high" />
          </>
        )}
        {images.map((img, i) => {
          const small = smallVariant(img.src);
          if (small && !imageError[i]) {
            return (
              <picture key={i}>
                <source media="(max-width: 640px)" srcSet={encodeURI(small)} /> {/* encoded: the paths contain spaces, which split a srcset */}
                {/* eslint-disable-next-line @next/next/no-img-element -- next/image cannot do srcset while images.unoptimized is on */}
                <img
                  src={img.src}
                  alt={img.alt}
                  fetchPriority={i === 0 ? "high" : undefined}
                  loading={i === 0 || near(i) ? "eager" : "lazy"}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-150 ${
                    i === activeIdx ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden={i !== activeIdx}
                  onError={() => handleError(i)}
                />
              </picture>
            );
          }
          return (
          <Image
            key={i}
            src={imageError[i] ? "/covers/desktop%20cover.webp" : img.src}
            alt={img.alt}
            fill
            // Only the visible first photo is preloaded and fetched at high priority
            // (it is the page's LCP); preloading three of them made them share
            // bandwidth on 4G. The rest load normally behind it.
            priority={i === 0}
            fetchPriority={i === 0 ? "high" : undefined}
            loading={i !== 0 && near(i) ? "eager" : undefined}
            quality={80}
            sizes="(max-width: 640px) 100vw, 60vw"
            className={`object-contain object-center transition-opacity duration-150 ${
              i === activeIdx ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== activeIdx}
            onError={() => handleError(i)}
          />
          );
        })}

        {/* Nav arrows - mobile: dark, desktop: navy */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 pointer-events-none">
          <button
            onClick={prev}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Fotografia anterioară"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Fotografia următoare"
          >
            ›
          </button>
        </div>

        {/* Dots - mobile only */}
        <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              aria-label={`Fotografia ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === activeIdx ? "bg-navy w-4" : "bg-charcoal/30 w-1.5"
              }`}
            />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
