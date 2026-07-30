"use client";
import { useState } from "react";
import Image from "next/image";
import { BUNDLES } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/products";
import { useCartStore } from "@/lib/store";
import { useCountry } from "@/lib/country";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
}

export function BundleUpsell({ product }: Props) {
  const { addItem } = useCartStore();
  const [addedPartnerId, setAddedPartnerId] = useState<string | null>(null);
  const country = useCountry();

  // Bundles are EUR-priced; an EUR bundle beside an AED product price confuses.
  // Hidden for UAE visitors (the AED test market).
  if (country === "AE") return null;

  const bundle = BUNDLES.find((b) =>
    b.slots.some((slot) => slot.includes(product.id))
  );
  if (!bundle) return null;

  const partnerSlot = bundle.slots.find((slot) => !slot.includes(product.id));
  if (!partnerSlot) return null;

  const partners = partnerSlot
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p && p.inStock);

  if (partners.length === 0) return null;

  const hasDiscount = bundle.discountPct > 0;

  const handleAdd = (partner: Product) => {
    addItem(product);
    addItem(partner);
    setAddedPartnerId(partner.id);
    setTimeout(() => setAddedPartnerId(null), 2200);
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
          {hasDiscount ? `-${bundle.discountPct}% КОМПЛЕКТ` : "КОМПЛЕКТ"}
        </span>
      </div>

      {/* One row per partner */}
      <div className="flex flex-col gap-4">
        {partners.map((partner) => {
          const fullPrice = product.price + partner.price;
          const displayPrice = hasDiscount
            ? +(fullPrice * (1 - bundle.discountPct / 100)).toFixed(2)
            : fullPrice;
          const isAdded = addedPartnerId === partner.id;
          const isLocked = addedPartnerId !== null && !isAdded;

          return (
            <div
              key={partner.id}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-opacity duration-300 ${
                isLocked ? "opacity-30" : ""
              }`}
            >
              {/* Left: thumbnails + description */}
              <div className="flex items-center gap-3 min-w-0">
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
                <div className="min-w-0">
                  <p className="font-sans text-[11px] font-medium tracking-wide text-charcoal leading-snug">
                    Добави <span className="text-navy">{partner.name}</span>
                  </p>
                  {hasDiscount && (
                    <p className="font-sans text-[10px] text-ink-faint tracking-wide leading-snug mt-0.5">
                      и спести {bundle.discountPct}% от общата цена
                    </p>
                  )}
                </div>
              </div>

              {/* Right: price + button */}
              <div className="flex items-center gap-3 sm:flex-shrink-0">
                <div className="text-right">
                  {hasDiscount && (
                    <p className="font-sans text-[10px] text-ink-faint line-through leading-none">
                      €{fullPrice.toFixed(2)}
                    </p>
                  )}
                  <p className="font-serif text-lg text-navy leading-tight">
                    €{displayPrice.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(partner)}
                  disabled={isLocked}
                  className={`font-sans text-[10px] font-medium tracking-[0.18em] uppercase px-4 py-2.5 border transition-all duration-200 active:scale-[0.97] whitespace-nowrap disabled:cursor-not-allowed ${
                    isAdded
                      ? "bg-navy border-navy text-white"
                      : "bg-transparent border-navy text-navy hover:bg-navy hover:text-white"
                  }`}
                >
                  {isAdded ? "✓ Добавено" : "Добави комплекта"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
