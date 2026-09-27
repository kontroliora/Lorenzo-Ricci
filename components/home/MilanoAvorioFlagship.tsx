"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { useCountry } from "@/lib/country";
import { displayPrice } from "@/lib/price";

interface Props {
  product: Product;
}

export function MilanoAvorioFlagship({ product }: Props) {
  // Live stock (wallet_inventory, same /api/stock/[slug] path as ProductCard /
  // ProductInfo). Sold out → the section STAYS, marked "Изчерпан" (owner's rule,
  // 2026-09-27: out-of-stock products stay listed, just not orderable). inStock:
  // false in lib/products.ts is the owner's off switch and counts as sold out too.
  // (No early return any more — it also used to skip the useCountry() hook below.)
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
  const price = displayPrice(product, useCountry());

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Image first on mobile (source order), left on desktop. The whole image
              is a link to the product, not just the text button below. */}
          <Link
            href={`/products/${product.slug}`}
            aria-label={`Виж ${product.name}`}
            className={`relative block aspect-square lg:aspect-[4/5] bg-white border border-border overflow-hidden ${isSoldOut ? "grayscale" : ""}`}
          >
            <Image
              src={product.coverImage.src}
              alt={product.coverImage.alt}
              fill
              loading="lazy"
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain object-center p-8 lg:p-12 transition-transform duration-500 hover:scale-[1.03]"
            />
          </Link>

          {/* Text */}
          <div>
            {product.badge && (
              <span className="inline-block bg-white text-navy border border-navy/20 font-sans text-[9px] font-medium tracking-[0.18em] uppercase px-2.5 py-1 mb-5">
                {product.badge}
              </span>
            )}
            <p className="section-tag mb-4">Lorenzo Ricci</p>
            <h2 className="font-serif text-display-md text-charcoal leading-tight mb-5">
              <Link href={`/products/${product.slug}`} className="hover:text-navy transition-colors duration-300">
                {product.name}
              </Link>
            </h2>
            <p className="font-sans text-sm font-light text-ink-muted leading-relaxed tracking-wide mb-8 max-w-sm">
              {product.shortDescription}
            </p>
            <div className="flex items-center gap-3 mb-8">
              <span className={`font-serif text-2xl ${isSoldOut ? "text-ink-faint" : "text-navy"}`}>{price.text}</span>
              {isSoldOut && (
                <span className="font-sans text-[10px] tracking-[0.22em] uppercase bg-charcoal/90 text-white px-3 py-1.5">
                  Изчерпан
                </span>
              )}
            </div>
            <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-3 w-fit group/btn">
              <span className="font-sans text-[10px] tracking-[0.28em] uppercase text-navy group-hover/btn:text-charcoal transition-colors duration-300">
                Разгледай продукта
              </span>
              <span className="text-navy/60 group-hover/btn:text-charcoal group-hover/btn:translate-x-1 transition-all duration-300">→</span>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
