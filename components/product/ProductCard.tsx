"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { reviewSummary } from "@/lib/reviews";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  learnMore?: boolean;
}

export function ProductCard({ product, priority = false, learnMore = false }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const { addItem } = useCartStore();

  // Live availability — a product at 0 available is shown sold-out in the grid,
  // automatically, for every category (matches /api/stock = the panel's "Налични").
  const [soldOut, setSoldOut] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/${product.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && typeof d.stock === "number") setSoldOut(d.stock === 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.slug]);

  const isWatch = product.category === "watches";
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  const productSummary = reviewSummary[product.slug];
  const reviewCount = productSummary?.count ?? 0;
  const avgRating = productSummary?.avg ?? 0;

  // Night image for watches is always images[1]
  const nightImage = isWatch ? (product.images[1] ?? product.coverImage) : null;
  // Second image for non-watch hover swap
  const secondImage = product.images[1] ?? product.coverImage;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleNightToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNight((n) => !n);
  };

  return (
    <div
      className="group relative flex flex-col product-card-hover"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image container */}
      <Link href={`/products/${product.slug}`} className={`block relative overflow-hidden bg-white aspect-square ${soldOut ? "grayscale" : ""}`}>

        {isWatch ? (
          <>
            {/* Day image - no transition class for instant switch */}
            <Image
              src={product.coverImage.src}
              alt={product.coverImage.alt}
              fill
              priority={priority}
              quality={85}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain object-center p-4 ${isNight ? "opacity-0" : "opacity-100"}`}
            />
            {/* Night image - no transition class for instant switch */}
            {nightImage && (
              <Image
                src={nightImage.src}
                alt={nightImage.alt}
                fill
                quality={85}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-contain object-center p-4 ${isNight ? "opacity-100" : "opacity-0"}`}
              />
            )}
            {/* Moon / Sun toggle button */}
            <button
              onClick={handleNightToggle}
              aria-label={isNight ? "Дневна снимка" : "Нощна снимка"}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-white transition-colors duration-200 shadow-sm"
            >
              {isNight ? (
                /* Sun */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500">
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="4"/>
                  <line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="2" y1="12" x2="4" y2="12"/>
                  <line x1="20" y1="12" x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-navy">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Non-watch: hover image swap */}
            <Image
              src={product.coverImage.src}
              alt={product.coverImage.alt}
              fill
              priority={priority}
              quality={85}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain object-center p-4 transition-all duration-700 ease-out ${
                hovered ? "opacity-0 scale-105" : "opacity-100 scale-100"
              }`}
            />
            <Image
              src={secondImage.src}
              alt={secondImage.alt}
              fill
              quality={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain object-center p-4 transition-all duration-700 ease-out ${
                hovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
            />
          </>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.badge && !soldOut && (
            <span className="bg-white/95 text-navy border border-navy/20 font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1">
              {product.badge}
            </span>
          )}
        </div>

        {/* Quick-add / learn-more overlay */}
        {product.inStock && !soldOut && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-navy/90 backdrop-blur-sm py-3.5 px-4 transition-all duration-400 ${
              hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full"
            }`}
          >
            {learnMore ? (
              <Link
                href={`/products/${product.slug}`}
                className="block w-full text-center font-sans text-xs font-medium tracking-[0.22em] uppercase text-white/80 hover:text-white transition-colors duration-200"
              >
                НАУЧИ ПОВЕЧЕ
              </Link>
            ) : (
              <button
                onClick={handleAdd}
                className={`w-full font-sans text-xs font-medium tracking-[0.22em] uppercase transition-colors duration-200 ${
                  added ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                {added ? "✓ ДОБАВЕНО" : "ДОБАВИ В КОЛИЧКАТА"}
              </button>
            )}
          </div>
        )}

        {/* Sold-out overlay — automatic when live available === 0 */}
        {soldOut && (
          <div className="absolute inset-0 z-[15] flex items-center justify-center bg-ivory/25">
            <span className="font-sans text-[10px] tracking-[0.22em] uppercase bg-charcoal/90 text-white px-3 py-1.5">
              Изчерпана наличност
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="pt-4 flex-1 flex flex-col">
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-serif text-lg text-charcoal group-hover:text-navy transition-colors duration-300 mb-1">
            {product.name}
          </h3>
        </Link>

        {reviewCount > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-[10px] ${i < Math.round(avgRating) ? "text-navy" : "text-ink-faint"}`}>★</span>
              ))}
            </div>
            <span className="font-sans text-[10px] text-ink-faint">
              {avgRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? "ревю" : "ревюта"}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center gap-3">
          <span className="font-serif text-xl text-navy">
            {product.currency}{product.price.toFixed(2)}
          </span>
          {hasDiscount && (
            <span className="font-sans text-xs text-ink-faint line-through">
              {product.currency}{product.originalPrice!.toFixed(2)}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
