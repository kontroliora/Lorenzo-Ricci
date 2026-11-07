"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGallerySwipe } from "@/lib/use-gallery-swipe";
import { PHOTO_PREVIEW_EVENT } from "@/lib/warm-product";
import type { ProductImage } from "@/lib/types";
import { GALLERY_SIZES } from "@/lib/image-loader";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
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
  // A sibling product was tapped (lib/warm-product.ts previewProductPhoto): its photo covers this one at once, until this
  // gallery receives the new product's photos (key changes) - or after 4 s if the navigation never happens.
  const [preview, setPreview] = useState<{ key: string; src: string } | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const on = (e: Event) => {
      setPreview({ key: galleryKey, src: (e as CustomEvent<string>).detail });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPreview(null), 4000);
    };
    window.addEventListener(PHOTO_PREVIEW_EVENT, on);
    return () => { window.removeEventListener(PHOTO_PREVIEW_EVENT, on); window.clearTimeout(timer); };
  }, [galleryKey]);
  const previewSrc = preview && preview.key === galleryKey ? preview.src : null;
  // The photos next to the visible one are loaded ahead, so a swipe never shows an empty box.
  const n = images.length;
  const near = (i: number) => n <= 1 || i === activeIdx || i === (activeIdx + 1) % n || i === (activeIdx - 1 + n) % n;
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
  const show = (i: number) => ready || near(i);
  const pick = (i: number) => { setReady(true); setActiveIdx(i); };

  const active = images[activeIdx];

  const handleError = (idx: number) => {
    setImageError((prev) => ({ ...prev, [idx]: true }));
  };

  const prev = () => { setReady(true); setActiveIdx((i) => (i - 1 + images.length) % images.length); };
  const next = () => { setReady(true); setActiveIdx((i) => (i + 1) % images.length); };

  // Swipe left/right on the main image changes the photo (phones); a vertical drag still scrolls the page, and a horizontal one
  // locks the page so it cannot drift (lib/use-gallery-swipe.ts).
  const onSwipe = useCallback((d: "next" | "prev") => {
    setReady(true);
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
            onClick={() => pick(i)}
            className={`relative flex-shrink-0 w-16 h-16 overflow-hidden transition-all duration-200 bg-white ${
              activeIdx === i
                ? "border border-navy"
                : "border border-border hover:border-navy/40"
            }`}
            aria-label={img.alt}
          >
            {show(i) && <Image
              src={imageError[i] ? "/covers/desktop%20cover.webp" : img.src}
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
        ref={box}
      >
        {/* All gallery images pre-rendered and stacked.
            The browser fetches every image on page load; switching is a CSS opacity
            toggle with zero network latency. */}
        {/* The first photo is the page's LCP: preloaded (with its srcset) and fetched at high priority. Each screen gets the
            resized copy that fits it (lib/image-loader.ts); the rest load lazily behind it. */}
        {images.map((img, i) => {
          if (!show(i)) return null;
          return (
          <Image
            key={i}
            src={imageError[i] ? "/covers/desktop%20cover.webp" : img.src}
            alt={img.alt}
            fill
            priority={i === 0}
            fetchPriority={i === 0 ? "high" : undefined}
            loading={i !== 0 && near(i) ? "eager" : undefined}
            quality={80}
            sizes={GALLERY_SIZES}
            className={`object-contain object-center transition-opacity duration-150 ${
              i === activeIdx ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== activeIdx}
            onError={() => handleError(i)}
          />
          );
        })}

        {previewSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- an already decoded URL, shown as is
          <img data-photo-preview src={previewSrc} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain object-center bg-white" />
        )}

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
