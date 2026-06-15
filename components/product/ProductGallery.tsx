"use client";
import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/types";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  const active = images[activeIdx];

  const handleError = (idx: number) => {
    setImageError((prev) => ({ ...prev, [idx]: true }));
  };

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
              src={imageError[i] ? "/covers/desktop%20cover.webp" : img.src}
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
      <div className="relative w-full aspect-square overflow-hidden bg-white border border-border">
        {/* All gallery images pre-rendered and stacked.
            The browser fetches every image on page load; switching is a CSS opacity
            toggle with zero network latency. */}
        {images.map((img, i) => (
          <Image
            key={i}
            src={imageError[i] ? "/covers/desktop%20cover.webp" : img.src}
            alt={img.alt}
            fill
            priority={i < 3}
            quality={90}
            sizes="(max-width: 640px) 100vw, 60vw"
            className={`object-contain object-center transition-opacity duration-150 ${
              i === activeIdx ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== activeIdx}
            onError={() => handleError(i)}
          />
        ))}

        {/* Nav arrows - mobile: dark, desktop: navy */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 pointer-events-none">
          <button
            onClick={() => setActiveIdx((i) => (i - 1 + images.length) % images.length)}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Предишна снимка"
          >
            ‹
          </button>
          <button
            onClick={() => setActiveIdx((i) => (i + 1) % images.length)}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center
              bg-charcoal/60 sm:bg-navy text-white
              hover:bg-charcoal sm:hover:bg-navy/80
              transition-colors duration-200 text-lg leading-none shadow-sm"
            aria-label="Следваща снимка"
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
