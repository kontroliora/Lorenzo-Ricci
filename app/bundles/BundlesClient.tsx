"use client";
import { useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import type { Product } from "@/lib/types";

interface BundleCardProps {
  id: string;
  label: string;
  productA: Product;
  productB: Product;
  discountPct: number;
}

function BundleCard({ label, productA, productB, discountPct }: BundleCardProps) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const fullPrice  = productA.price + productB.price;
  const discounted = +(fullPrice * (1 - discountPct / 100)).toFixed(2);
  const savings    = +(fullPrice - discounted).toFixed(2);

  const handleAdd = () => {
    addItem(productA);
    addItem(productB);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div className="bg-white border border-border flex flex-col hover:shadow-[0_4px_24px_-8px_rgba(15,40,80,0.10)] transition-shadow duration-400">
      {/* Top row: badge + label */}
      <div className="flex items-center justify-between px-5 pt-5 pb-0">
        <p className="font-sans text-[10px] font-medium tracking-[0.22em] uppercase text-navy">
          {label}
        </p>
        <span className="font-sans text-[9px] font-semibold tracking-[0.14em] uppercase bg-navy text-white px-2 py-0.5">
          -{discountPct}% отстъпка
        </span>
      </div>

      {/* Compact thumbnail row */}
      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-ivory-warm flex-shrink-0">
          <Image
            src={productA.coverImage.src}
            alt={productA.coverImage.alt}
            fill
            quality={75}
            sizes="64px"
            className="object-contain p-1.5"
          />
        </div>

        <span className="text-ink-faint text-base font-light select-none">+</span>

        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-ivory-warm flex-shrink-0">
          <Image
            src={productB.coverImage.src}
            alt={productB.coverImage.alt}
            fill
            quality={75}
            sizes="64px"
            className="object-contain p-1.5"
          />
        </div>

        <div className="ml-2 min-w-0">
          <p className="font-sans text-[11px] text-ink-soft leading-snug truncate">{productA.name}</p>
          <p className="font-sans text-[10px] text-ink-faint leading-snug truncate mt-0.5">
            + {productB.name}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 mt-4 h-px bg-border" />

      {/* Price + button */}
      <div className="px-5 pb-5 pt-4 flex items-center justify-between gap-3 mt-auto">
        <div>
          <p className="font-sans text-[10px] text-ink-faint line-through leading-none">
            €{fullPrice.toFixed(2)}
          </p>
          <p className="font-serif text-2xl text-navy leading-tight">€{discounted.toFixed(2)}</p>
          <p className="font-sans text-[10px] text-ink-faint tracking-wide mt-0.5">
            Спестявате €{savings.toFixed(2)}
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
  );
}

interface Props {
  bundles: BundleCardProps[];
}

export function BundlesClient({ bundles }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {bundles.map((b) => (
        <BundleCard key={b.id} {...b} />
      ))}
    </div>
  );
}
