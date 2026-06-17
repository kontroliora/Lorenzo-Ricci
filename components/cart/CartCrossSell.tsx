"use client";
import { useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import type { Product } from "@/lib/types";

const WALLET_FOR_CARDHOLDER: Record<string, string> = {
  "cardholder-bianco":     "wallet-alabastro",
  "cardholder-valentina":  "wallet-rubino",
  "cardholder-ambra":      "wallet-rubino",
  "cardholder-zaffiro":    "wallet-alabastro",
};

const BUNDLE_PARTNER: Record<string, string> = {
  "bracelet-diamante-cross":   "necklace-aurelius",
  "bracelet-milano-twist":     "necklace-milano-twist",
  "bracelet-milano-forte":     "necklace-milano-forte",
  "necklace-aurelius":         "bracelet-diamante-cross",
  "necklace-grande-imperiale": "bracelet-diamante-cross",
  "necklace-milano-twist":     "bracelet-milano-twist",
  "necklace-milano-forte":     "bracelet-milano-forte",
};

const WATCH_UPSELL = [
  "bracelet-diamante-cross",
  "bracelet-milano-forte",
  "necklace-aurelius",
];

const FALLBACK_UPSELL = [
  "bracelet-diamante-cross",
  "necklace-aurelius",
  "bracelet-milano-forte",
];

function computeSuggestions(cartIds: string[]): string[] {
  const inCart = new Set(cartIds);
  const candidates: string[] = [];

  for (const id of cartIds) {
    const wallet = WALLET_FOR_CARDHOLDER[id];
    if (wallet) candidates.push(wallet);
    const partner = BUNDLE_PARTNER[id];
    if (partner) candidates.push(partner);
  }

  const hasWatch = cartIds.some(
    (id) => id.startsWith("chrono") || id.startsWith("golden") || id.startsWith("polar")
  );
  if (hasWatch) candidates.push(...WATCH_UPSELL);

  if (candidates.length < 2) candidates.push(...FALLBACK_UPSELL);

  const seen = new Set<string>();
  return candidates.filter((id) => {
    if (inCart.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 3);
}

export function CartCrossSell() {
  const { items, addItem } = useCartStore();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  const cartIds = items.map((i) => i.product.id);
  const suggestionIds = computeSuggestions(cartIds);

  const suggestions = suggestionIds
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p && p.inStock);

  if (suggestions.length === 0) return null;

  const handleAdd = (product: Product) => {
    addItem(product);
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.add(product.id);
      return next;
    });
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="mt-2 pt-4 border-t border-white/8">
      <p className="font-sans text-[9px] font-medium tracking-[0.28em] uppercase text-white/35 mb-3">
        Често поръчвано заедно
      </p>
      <div className="flex flex-col gap-3">
        {suggestions.map((product) => {
          const isAdded = addedIds.has(product.id);
          return (
            <div key={product.id} className="flex items-center gap-3">
              <div className="relative w-12 h-14 flex-shrink-0 bg-white/5 overflow-hidden">
                <Image
                  src={product.coverImage.src}
                  alt={product.coverImage.alt}
                  fill
                  quality={65}
                  sizes="48px"
                  className="object-cover object-center"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[11px] font-medium text-white leading-snug truncate">
                  {product.name}
                </p>
                <p className="font-sans text-[10px] text-white/40 mt-0.5">
                  {product.currency}{product.price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => handleAdd(product)}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center border transition-all duration-200 ${
                  isAdded
                    ? "bg-navy border-navy text-white"
                    : "border-white/25 text-white/50 hover:border-white/60 hover:text-white"
                }`}
                aria-label={`Добави ${product.name}`}
              >
                {isAdded ? (
                  <svg
                    width="12" height="12" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
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
