"use client";
import Image from "next/image";
import { useState } from "react";
import { useRoCart } from "@/lib/ro/store";
import { getProductBySlug } from "@/lib/products";
import { localizeProduct } from "@/lib/ro/catalog";
import { useLeatherStock } from "@/lib/use-gifts";
import { opoNudges } from "@/lib/one-plus-one";
import { smallOrOriginal } from "@/lib/image-variant";
import { roCartLine } from "@/components/ro/product/cart-line";
import type { Product } from "@/lib/types";

// Romanian counterpart of components/cart/OnePlusOneNudge.tsx: when the next item of a 1+1 group would be free, say so and
// offer the group's other models for a one-tap add (lei prices through roCartLine, like every Romanian add-to-cart).
export function RoOnePlusOneNudge() {
  const items = useRoCart((s) => s.items);
  const addItem = useRoCart((s) => s.addItem);
  const stock = useLeatherStock(true);
  const [added, setAdded] = useState<string | null>(null);
  const groups = opoNudges(items.map((i) => ({ slug: i.slug, unit: i.ron, quantity: i.quantity, onSale: i.onSale })));
  if (groups.length === 0) return null;
  const inCart = new Set(items.map((i) => i.slug));

  return (
    <>
      {groups.map((g) => {
        const options = [...g.slugs]
          .map((slug) => getProductBySlug(slug))
          .filter((p): p is Product => !!p && p.inStock && (stock?.[p.slug] ?? 1) > 0)
          .sort((a, b) => Number(inCart.has(a.slug)) - Number(inCart.has(b.slug)))
          .map(localizeProduct);
        return (
          <div key={g.id} data-testid="opo-nudge" className="mt-2 pt-4 border-t border-white/8">
            <p className="font-sans text-xs text-[#D4AF37] tracking-wide mb-3">◈ {g.text.ro.addOne}</p>
            {options.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {options.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      addItem(roCartLine(p, stock?.[p.slug]));
                      setAdded(p.slug);
                      setTimeout(() => setAdded(null), 1500);
                    }}
                    aria-label={`Adăugați ${p.name}`}
                    className="relative flex-shrink-0 w-16 group"
                  >
                    <span className="relative block w-16 h-16 bg-white/5 overflow-hidden border border-white/10 group-hover:border-white/40 transition-colors">
                      <Image src={smallOrOriginal(p.coverImage.src)} alt={p.coverImage.alt} fill quality={60} sizes="64px" className="object-cover" />
                      <span className={`absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center text-sm leading-none ${added === p.slug ? "bg-navy text-white" : "bg-white text-navy"}`}>
                        {added === p.slug ? "✓" : "+"}
                      </span>
                    </span>
                    <span className="block mt-1 font-sans text-[10px] text-white/60 leading-tight truncate">{g.text.ro.shortName(p.name)}</span>
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
