"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/lib/types";
import { smallVariant, smallOrOriginal } from "@/lib/image-variant";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Speed (29.10.2026, live mobile LCP 5-9 s): until the page has loaded and the browser is idle, only the visible photo is
  // downloaded - the other photos and the thumbnails competed with it for bandwidth (images are served unresized). They appear
  // right after, or at once when the visitor taps a thumbnail / arrow or swipes.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const go = () => { if (!cancelled) setReady(true); };
    const idle = () => { if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 800); };
    if (document.readyState === "complete") idle(); else window.addEventListener("load", idle, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", idle); };
  }, [ready]);
  const show = (i: number) => ready || i === activeIdx;
  const pick = (i: number) => { setReady(true); setActiveIdx(i); };

  const active = images[activeIdx];

  const handleError = (idx: number) => {
    setImageError((prev) => ({ ...prev, [idx]: true }));
  };

  const prev = () => { setReady(true); setActiveIdx((i) => (i - 1 + images.length) % images.length); };
  const next = () => { setReady(true); setActiveIdx((i) => (i + 1) % images.length); };

  // Swipe left/right on the main image changes the photo (phones). A mostly
  // vertical drag is left to the page so scrolling still works (touch-pan-y).
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next(); else prev();
  };

  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
      {/* Thumbnails */}
      <div className="flex flex-row sm:flex-col gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-y-auto sm:max-h-[600px] pb-1 sm:pb-0 flex-shrink-0">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`relative flex-shrink-0 w-16 h-16 overflow-hidden transition-all duration-200 bg-white ${
              activeIdx === i
                ? "border border-navy"
                : "border border-border hover:border-navy/40"
            }`}
            aria-label={img.alt}
          >
            {show(i) && <Image
              src={imageError[i] ? "/covers/desktop%20cover.webp" : smallOrOriginal(img.src)}
              alt={img.alt}
              fill
              quality={60}
              sizes="64px"
              className="object-contain object-center p-1"
              onError={() => handleError(i)}
            />}
          </button>
        ))}
      </div>

      {/* Main image - flex-1 takes remaining width; inner div enforces square */}
      <div className="flex-1 min-w-0 w-full sm:w-auto sm:self-start">
      <div
        className="relative w-full aspect-square overflow-hidden bg-white border border-border touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
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
          if (!show(i)) return null;
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
                  loading={i === 0 ? "eager" : "lazy"}
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
            className="pointer-events-auto w-11 h-11 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Предишна снимка"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="pointer-events-auto w-11 h-11 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Следваща снимка"
          >
            ›
          </button>
        </div>

        {/* Dots - mobile only */}
        <div className="sm:hidden absolute bottom-0 left-1/2 -translate-x-1/2 flex">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => pick(i)}
              aria-label={`Снимка ${i + 1}`}
              className="h-11 min-w-[28px] px-[11px] flex items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-200 ${
                  i === activeIdx ? "bg-navy w-4" : "bg-charcoal/30 w-1.5"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
