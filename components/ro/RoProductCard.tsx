"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useRoCart } from "@/lib/ro/store";
import { fmtRON } from "@/lib/ro/config";
import { ronOf } from "@/lib/ro/config";
import { useLeatherStock } from "@/lib/use-gifts";

// Romanian counterpart of components/product/ProductCard.tsx, shared by the home sections and the listings.
// Expects a product already passed through localizeProduct() (Romanian text, no crossed-out price). Price in lei,
// never a crossed-out figure, never a sale badge, link under /ro/produse/<slug>, own cart (useRoCart).
interface RoProductCardProps {
  product: Product;
  priority?: boolean;
  learnMore?: boolean;
}

// Defence in depth: the Romanian storefront makes no sale/discount claim (no price history there), and must
// never print Bulgarian wording if an overlay entry is missing. Cyrillic block U+0400-U+04FF, tested by code
// point so no Cyrillic literal sits in this file.
const SALE_BADGE = /reducere|promo|namalenie|%/i;
const hasCyrillic = (text: string) => Array.from(text).some((ch) => { const c = ch.charCodeAt(0); return c >= 1024 && c <= 1279; });

/** The badge text to show on a Romanian card/tile, or undefined (no badge, a sale badge, or foreign-script wording). */
export const roBadge = (badge?: string): string | undefined =>
  badge && !SALE_BADGE.test(badge) && !hasCyrillic(badge) ? badge : undefined;

export function RoProductCard({ product, priority = false, learnMore = false }: RoProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const addItem = useRoCart((s) => s.addItem);

  // Live availability: one batched call shared by every card on the page (wallet_inventory, same numbers as
  // /api/stock/<slug> and the panel). `inStock: false` in lib/products.ts is the owner's off switch.
  const stockMap = useLeatherStock(true);
  const liveStock = stockMap?.[product.slug];
  const isSoldOut = (typeof liveStock === "number" && liveStock <= 0) || !product.inStock;

  const isWatch = product.category === "watches";
  const href = `/ro/produse/${product.slug}`;
  const badge = roBadge(product.badge);

  // Night image for watches is always images[1]
  const nightImage = isWatch ? (product.images[1] ?? product.coverImage) : null;
  // Second image for non-watch hover swap
  const secondImage = product.images[1] ?? product.coverImage;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      ron: ronOf(product),
      image: product.coverImage.src,
      imageAlt: product.coverImage.alt,
      stock: typeof liveStock === "number" ? liveStock : undefined,
    });
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
      <Link href={href} className={`block relative overflow-hidden bg-white aspect-square ${isSoldOut ? "grayscale" : ""}`}>

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
              aria-label={isNight ? "Imagine de noapte" : "Imagine de zi"}
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

        {/* Badge (never a sale badge) */}
        {badge && !isSoldOut && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            <span className="bg-white/95 text-navy border border-navy/20 font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1">
              {badge}
            </span>
          </div>
        )}

        {/* Quick-add / learn-more overlay */}
        {!isSoldOut && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-navy/90 backdrop-blur-sm py-3.5 px-4 transition-all duration-400 ${
              hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full"
            }`}
          >
            {learnMore ? (
              // Not a <Link>: this sits inside the outer image <Link> above, and an <a> can't nest inside
              // another <a> (invalid HTML, breaks hydration). Same destination, so the outer Link handles the click.
              <span className="block w-full text-center font-sans text-xs font-medium tracking-[0.22em] uppercase text-white/80 hover:text-white transition-colors duration-200">
                AFLĂ MAI MULTE
              </span>
            ) : (
              <button
                onClick={handleAdd}
                className={`w-full font-sans text-xs font-medium tracking-[0.22em] uppercase transition-colors duration-200 ${
                  added ? "text-white" : "text-white/80 hover:text-white"
                }`}
              >
                {added ? "✓ ADĂUGAT" : "ADAUGĂ ÎN COȘ"}
              </button>
            )}
          </div>
        )}

        {/* Sold-out overlay - live available === 0, or switched off in lib/products.ts */}
        {isSoldOut && (
          <div className="absolute inset-0 z-[15] flex items-center justify-center bg-ivory/25">
            <span className="font-sans text-[10px] tracking-[0.22em] uppercase bg-charcoal/90 text-white px-3 py-1.5">
              Stoc epuizat
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="pt-4 flex-1 flex flex-col">
        <Link href={href}>
          <h3 className="font-serif text-lg text-charcoal group-hover:text-navy transition-colors duration-300 mb-1">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-center gap-3">
          <span className="font-serif text-xl text-navy">
            {fmtRON(ronOf(product))}
          </span>
        </div>
      </div>
    </div>
  );
}
