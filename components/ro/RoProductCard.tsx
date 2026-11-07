"use client";
import Image from "next/image";
import { smallOrOriginal } from "@/lib/image-variant";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useRoCart } from "@/lib/ro/store";
import { fmtRON, ronOf, ronOriginalOf, roNeedsPrepayment, roShipsFree } from "@/lib/ro/config";
import { FreeShippingBadge, OnePlusOneLine } from "@/components/product/PriceExtras";
import { opoGroupOf } from "@/lib/one-plus-one";
import { opoPriceLineRo } from "@/lib/ro/config";
import { useLeatherStock } from "@/lib/use-gifts";
import { lowStockCount, savingsRon, CARD_SAVINGS_CLASS, CARD_LOW_STOCK_CLASS } from "@/lib/home-card-hints";
import { hasCyrillic, roDisplayName, roSafeText } from "@/components/ro/listing/ro-display";

// Romanian counterpart of components/product/ProductCard.tsx, shared by the home sections and the listings.
// Expects a product already passed through localizeProduct() (Romanian text; price and sale kept as on the Bulgarian site).
// Price in lei: the current price, and while the product is on sale the old price crossed out next to it plus the sale
// badge, exactly like the Bulgarian card. Link under /ro/produse/<slug>, own cart (useRoCart).
interface RoProductCardProps {
  product: Product;
  priority?: boolean;
  learnMore?: boolean;
  /** Zoom the cover photo (not the hover one), e.g. on a necklace's pendant in the home "Нова колекция" row. */
  coverZoom?: { scale: number; origin: string };
}

/**
 * The badge text to show on a Romanian card/tile, or undefined (no badge, or wording that is still in Bulgarian because
 * the Romanian overlay has no entry for the product yet: never print foreign-script text on a Romanian page).
 */
export const roBadge = (badge?: string): string | undefined =>
  badge && !hasCyrillic(badge) ? badge : undefined;

export function RoProductCard({ product, priority = false, learnMore = false, coverZoom }: RoProductCardProps) {
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
  const name = roDisplayName(product);
  const ron = ronOf(product);
  const ronOriginal = ronOriginalOf(product); // defined while on sale: crossed-out price in lei
  const saved = savingsRon(product);
  const left = !isSoldOut ? lowStockCount(liveStock) : null; // both hint lines on every card (homepage and listings)
  const shipsFree = !isSoldOut && roShipsFree(product);
  const opo = isSoldOut ? undefined : opoGroupOf(product.slug); // 1+1 group: badge on the photo + line under the price

  // Night image for watches is always images[1]
  const nightImage = isWatch ? (product.images[1] ?? product.coverImage) : null;
  // Second image for non-watch hover swap
  const secondImage = product.images[1] ?? product.coverImage;
  // Alt text is Romanian from the overlay; if an entry is missing the product name is used rather than Bulgarian text.
  const coverAlt = roSafeText(product.coverImage.alt, name);
  const nightAlt = roSafeText(nightImage?.alt, name);
  const secondAlt = roSafeText(secondImage.alt, name);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      slug: product.slug,
      sku: product.sku,
      name,
      ron,
      originalRon: ronOriginal,
      onSale: ronOriginal !== undefined,
      prepay: roNeedsPrepayment(product),
      image: product.coverImage.src,
      imageAlt: coverAlt,
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
      <Link href={href} className={`block relative overflow-hidden bg-white aspect-square ${isSoldOut ? "grayscale [&_img]:opacity-60" : ""}`}>

        {isWatch ? (
          <>
            {/* Day image - no transition class for instant switch */}
            <Image
              src={smallOrOriginal(product.coverImage.src)}
              alt={coverAlt}
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
                alt={nightAlt}
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
            <div className="absolute inset-0" style={coverZoom ? { transform: `scale(${coverZoom.scale})`, transformOrigin: coverZoom.origin } : undefined}>
              <Image
                src={smallOrOriginal(product.coverImage.src)}
                alt={coverAlt}
                fill
                priority={priority}
                quality={85}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-contain object-center p-4 transition-all duration-700 ease-out ${
                  hovered ? "opacity-0 scale-105" : "opacity-100 scale-100"
                }`}
              />
            </div>
            <Image
              src={secondImage.src}
              alt={secondAlt}
              fill
              quality={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-contain object-center p-4 transition-all duration-700 ease-out ${
                hovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
            />
          </>
        )}

        {/* Badges: the product's own badge, including the sale badge (same as the Bulgarian card) */}
        {((badge && !isSoldOut) || opo) && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {badge && !isSoldOut && (
              <span className="bg-white/95 text-navy border border-navy/20 font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1">
                {badge}
              </span>
            )}
            {opo && (
              <span data-testid="card-opo-badge" className="bg-[#B3121F] text-white font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1">
                {opo.text.ro.badge}
              </span>
            )}
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
            <span data-testid="sold-out-badge" className="font-sans text-[10px] tracking-[0.22em] uppercase bg-charcoal/90 text-white px-3 py-1.5">
              Stoc epuizat
            </span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="pt-4 flex-1 flex flex-col">
        <Link href={href}>
          <h3 className="font-serif text-lg text-charcoal group-hover:text-navy transition-colors duration-300 mb-1">
            {name}
          </h3>
        </Link>

        <div className="mt-auto flex items-center gap-3">
          <span className={`font-serif text-xl ${isSoldOut ? "text-ink-muted" : "text-navy"}`}>
            {fmtRON(ron)}
          </span>
          {ronOriginal !== undefined && (
            <span className="font-sans text-xs text-ink-muted line-through">
              <span className="sr-only">Preț inițial: </span>
              {fmtRON(ronOriginal)}
            </span>
          )}
        </div>

        {saved !== null && !isSoldOut && (
          <p data-testid="home-savings" className={`mt-1 ${CARD_SAVINGS_CLASS}`}>Economisiți {fmtRON(saved)}</p>
        )}
        {opo && <OnePlusOneLine badge={opo.text.ro.badge} line={opoPriceLineRo(product.slug)} size="card" />}
        {shipsFree && (
          <div className="mt-1.5"><FreeShippingBadge text="Livrare gratuită" size="card" /></div>
        )}
        {left !== null && (
          <p data-testid="home-low-stock" className={`mt-1 ${CARD_LOW_STOCK_CLASS}`}>Au mai rămas {left} buc.</p>
        )}
      </div>
    </div>
  );
}
