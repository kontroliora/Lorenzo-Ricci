"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtRON, ronOf, ronOriginalOf, roNeedsPrepayment } from "@/lib/ro/config";
import { safeText, type RoTileProduct } from "./ro-home-utils";

// Romanian counterpart of components/home/MilanoAvorioFlagship.tsx: the one-of-a-kind crocodile bag, EUR 4000 base
// price (the page hands it in price-overridden and localized). Price in lei; from EUR 1500 up the product is sold on
// prepayment arranged directly with the shop (no cash on delivery), the same rule as on the Bulgarian site.
interface Props {
  product: RoTileProduct;
}

export function RoMilanoAvorioFlagship({ product }: Props) {
  // Live stock (wallet_inventory, same /api/stock/[slug] path as the product cards and the product page). Sold out →
  // the section STAYS, marked "Epuizat" (owner's rule: out-of-stock products stay listed, just not orderable).
  // inStock: false in lib/products.ts is the owner's off switch and counts as sold out too.
  const [soldOut, setSoldOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/${product.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && typeof d.stock === "number") setSoldOut(d.stock === 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.slug]);

  const isSoldOut = soldOut || !product.inStock;
  const href = `/ro/produse/${product.slug}`;
  const badge = safeText(product.badge);
  const description = safeText(product.shortDescription);
  const oldRon = ronOriginalOf(product);

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Image first on mobile (source order), left on desktop. The whole image is a link to the product, not
              just the text button below. */}
          <Link
            href={href}
            aria-label={`Vedeți ${product.name}`}
            className={`relative block aspect-square lg:aspect-[4/5] bg-white border border-border overflow-hidden ${isSoldOut ? "grayscale" : ""}`}
          >
            <Image
              src={product.coverImage.src}
              alt={safeText(product.coverImage.alt) ?? product.name}
              fill
              loading="lazy"
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain object-center p-8 lg:p-12 transition-transform duration-500 hover:scale-[1.03]"
            />
          </Link>

          {/* Text */}
          <div>
            {badge && (
              <span className="inline-block bg-white text-navy border border-navy/20 font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1 mb-5">
                {badge}
              </span>
            )}
            <p className="section-tag mb-4">Lorenzo Ricci</p>
            <h2 className="font-serif text-display-md text-charcoal leading-tight mb-5">
              <Link href={href} className="hover:text-navy transition-colors duration-300">
                {product.name}
              </Link>
            </h2>
            {description && (
              <p className="font-sans text-sm font-light text-ink-muted leading-relaxed tracking-wide mb-8 max-w-sm">
                {description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
              <span className={`font-serif text-2xl ${isSoldOut ? "text-ink-faint" : "text-navy"}`}>{fmtRON(ronOf(product))}</span>
              {oldRon !== undefined && (
                <span className="font-sans text-sm text-ink-muted line-through">{fmtRON(oldRon)}</span>
              )}
              {isSoldOut && (
                <span className="font-sans text-[10px] tracking-[0.22em] uppercase bg-charcoal/90 text-white px-3 py-1.5">
                  Epuizat
                </span>
              )}
            </div>
            {/* Prepayment note: shown only while the product really needs it (price at or above the threshold) */}
            {!isSoldOut && roNeedsPrepayment(product) ? (
              <p className="font-sans text-xs font-light text-ink-muted leading-relaxed tracking-wide mb-8 max-w-sm">
                Se comandă cu plata în avans (fără ramburs), stabilită direct cu noi.
              </p>
            ) : (
              <div className="mb-5" />
            )}
            <Link href={href} className="inline-flex items-center gap-3 w-fit group/btn">
              <span className="font-sans text-[10px] tracking-[0.28em] uppercase text-navy group-hover/btn:text-charcoal transition-colors duration-300">
                Descoperiți produsul
              </span>
              <span className="text-navy/60 group-hover/btn:text-charcoal group-hover/btn:translate-x-1 transition-all duration-300">→</span>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
