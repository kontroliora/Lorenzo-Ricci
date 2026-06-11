"use client";
import { useState } from "react";
import Image from "next/image";
import { BUNDLES } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/products";
import { useCartStore } from "@/lib/store";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
}

export function BundleUpsell({ product }: Props) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const bundle = BUNDLES.find((b) =>
    b.slots.some((slot) => slot.includes(product.id))
  );
  if (!bundle) return null;

  const partnerSlot = bundle.slots.find((slot) => !slot.includes(product.id));
  if (!partnerSlot) return null;

  const partner = getProductBySlug(partnerSlot[0]);
  if (!partner) return null;

  const fullPrice  = product.price + partner.price;
  const discounted = +(fullPrice * 0.9).toFixed(2);

  const handleAdd = () => {
    addItem(product);
    addItem(partner);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      {/* Label row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-px bg-navy/40" />
        <p className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
          Завърши визията
        </p>
        <span className="ml-auto font-sans text-[9px] font-semibold tracking-[0.14em] uppercase bg-navy text-white px-2 py-0.5">
          -10% КОМПЛЕКТ
        </span>
      </div>

      {/* Desktop: single row - [thumbs + text] - [price + button] */}
      {/* Mobile: two rows stacked compactly */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        {/* Left: thumbnails + description */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Thumbnails */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border bg-ivory-warm">
              <Image
                src={product.coverImage.src}
                alt={product.coverImage.alt}
                fill
                quality={75}
                sizes="56px"
                className="object-contain p-1.5"
              />
            </div>
            <span className="text-ink-faint text-base font-light select-none">+</span>
            <div className="relative w-14 h-14 rounded-md overflow-hidden border border-border bg-ivory-warm">
              <Image
                src={partner.coverImage.src}
                alt={partner.coverImage.alt}
                fill
                quality={75}
                sizes="56px"
                className="object-contain p-1.5"
              />
            </div>
          </div>

          {/* Text */}
          <div className="min-w-0">
            <p className="font-sans text-[11px] font-medium tracking-wide text-charcoal leading-snug">
              Добави <span className="text-navy">{partner.name}</span>
            </p>
            <p className="font-sans text-[10px] text-ink-faint tracking-wide leading-snug mt-0.5">
              и спести 10% от общата цена
            </p>
          </div>
        </div>

        {/* Right: price + button */}
        <div className="flex items-center gap-3 sm:flex-shrink-0">
          <div className="text-right">
            <p className="font-sans text-[10px] text-ink-faint line-through leading-none">
              €{fullPrice.toFixed(2)}
            </p>
            <p className="font-serif text-lg text-navy leading-tight">
              €{discounted.toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className={`font-sans text-[10px] font-medium tracking-[0.18em] uppercase px-4 py-2.5 border transition-all duration-200 active:scale-[0.97] whitespace-nowrap ${
              added
                ? "bg-navy border-navy text-white"
                : "bg-transparent border-navy text-navy hover:bg-navy hover:text-white"
            }`}
          >
            {added ? "✓ Добавено" : "Добави комплекта"}
          </button>
        </div>
      </div>
    </div>
  );
}
