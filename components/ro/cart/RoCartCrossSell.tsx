"use client";
import Image from "next/image";
import { useState } from "react";
import { useRoCart } from "@/lib/ro/store";
import { getProductBySlug } from "@/lib/products";
import { localizeProduct, RO_SLUGS } from "@/lib/ro/catalog";
import { fmtRON, ronOf } from "@/lib/ro/config";
import { useLeatherStock } from "@/lib/use-gifts";
import { opoCrossSell, opoSuggestions } from "@/lib/one-plus-one";
import { roCartLine } from "@/components/ro/product/cart-line";
import type { Product } from "@/lib/types";

// Romanian counterpart of components/cart/CartCrossSell.tsx, for a cart holding items of a running 1+1 group (the new jewellery,
// the port-carduri): more of that same group, sold in Romania, in stock and not in the cart yet - "the next one is free" (odd count)
// or "two more, one free" (even). Prices in lei; adds through roCartLine like every Romanian add-to-cart. Other carts: nothing.
export function RoCartCrossSell() {
  const items = useRoCart((s) => s.items);
  const addItem = useRoCart((s) => s.addItem);
  const stock = useLeatherStock(true);
  const [added, setAdded] = useState<string | null>(null);

  const opo = opoCrossSell(items.map((i) => ({ slug: i.slug, unit: i.ron, quantity: i.quantity, onSale: i.onSale })));
  if (!opo) return null;
  const available = (slug: string) => {
    const p = getProductBySlug(slug);
    return !!p && p.inStock && RO_SLUGS.includes(slug) && (stock?.[slug] ?? 1) > 0;
  };
  const suggestions = opoSuggestions(opo.group, items.map((i) => i.slug), available)
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p)
    .map(localizeProduct);
  if (suggestions.length === 0) return null;

  return (
    <div data-testid="cart-cross-sell" data-group={opo.group.id} className="mt-2 pt-4 border-t border-white/8">
      <p className="font-sans text-xs text-[#D4AF37] tracking-wide mb-3">◈ {opo.group.text.ro.crossSell[opo.odd ? "odd" : "even"]}</p>
      <div className="flex flex-col gap-3">
        {suggestions.map((p) => {
          const isAdded = added === p.slug;
          return (
            <div key={p.slug} className="flex items-center gap-3">
              <div className="relative w-12 h-14 flex-shrink-0 bg-white/5 overflow-hidden">
                <Image src={p.coverImage.src} alt={p.coverImage.alt} fill quality={60} sizes="48px" className="object-cover object-center" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[11px] font-medium text-white leading-snug truncate">{p.name}</p>
                <p className="font-sans text-[10px] text-white/40 mt-0.5">{fmtRON(ronOf(p))}</p>
              </div>
              <button
                onClick={() => {
                  addItem(roCartLine(p, stock?.[p.slug]));
                  setAdded(p.slug);
                  setTimeout(() => setAdded(null), 2000);
                }}
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center border transition-all duration-200 ${
                  isAdded ? "bg-navy border-navy text-white" : "border-white/25 text-white/50 hover:border-white/60 hover:text-white"
                }`}
                aria-label={`Adăugați ${p.name}`}
              >
                {isAdded ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-base leading-none">+</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
