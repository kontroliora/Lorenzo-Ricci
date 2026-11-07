"use client";
import Image from "next/image";
import { useState } from "react";
import { useCartStore } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import { useLeatherStock } from "@/lib/use-gifts";
import { opoLines } from "@/lib/bundles";
import { opoNudges } from "@/lib/one-plus-one";
import { smallOrOriginal } from "@/lib/image-variant";
import type { Product } from "@/lib/types";

// 1+1 groups (lib/one-plus-one.ts): when the next item of a group would be free (an odd number of cardholders), say so and offer
// the group's other models for a one-tap add. Models already in the cart come last; nothing out of stock is offered.
export function OnePlusOneNudge() {
  const { items, addItem } = useCartStore();
  const stock = useLeatherStock(true);
  const [added, setAdded] = useState<string | null>(null);
  const groups = opoNudges(opoLines(items));
  if (groups.length === 0) return null;
  const inCart = new Set(items.map((i) => i.product.slug));

  return (
    <>
      {groups.map((g) => {
        const options = [...g.slugs]
          .map((slug) => getProductBySlug(slug))
          .filter((p): p is Product => !!p && p.inStock && (stock?.[p.slug] ?? 1) > 0)
          .sort((a, b) => Number(inCart.has(a.slug)) - Number(inCart.has(b.slug)));
        return (
          <div key={g.id} data-testid="opo-nudge" className="mt-2 pt-4 border-t border-white/8">
            <p className="font-sans text-xs text-[#D4AF37] tracking-wide mb-3">◈ {g.text.bg.addOne}</p>
            {options.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {options.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      addItem({ ...p, stock: stock?.[p.slug] ?? p.stock });
                      setAdded(p.slug);
                      setTimeout(() => setAdded(null), 1500);
                    }}
                    aria-label={`Добави ${p.name}`}
                    className="relative flex-shrink-0 w-16 group"
                  >
                    <span className="relative block w-16 h-16 bg-white/5 overflow-hidden border border-white/10 group-hover:border-white/40 transition-colors">
                      <Image src={smallOrOriginal(p.coverImage.src)} alt={p.coverImage.alt} fill quality={60} sizes="64px" className="object-cover" />
                      <span className={`absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center text-sm leading-none ${added === p.slug ? "bg-navy text-white" : "bg-white text-navy"}`}>
                        {added === p.slug ? "✓" : "+"}
                      </span>
                    </span>
                    <span className="block mt-1 font-sans text-[10px] text-white/60 leading-tight truncate">{g.text.bg.shortName(p.name)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
