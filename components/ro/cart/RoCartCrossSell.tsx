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
import { COLLECTION_PIECES, collectionCartTop3, collectionGroupOf, pieceLive } from "@/lib/new-collection";
import { useCollectionBestSellers } from "@/lib/use-best-sellers";
import { CartFreeJewel, FREE_JEWEL_RO, type FreeJewelItem } from "@/components/cart/CartFreeJewel";

// Romanian counterpart of components/cart/CartCrossSell.tsx, for a cart holding items of a running 1+1 group (the new jewellery,
// the port-carduri): more of that same group, sold in Romania, in stock and not in the cart yet - "the next one is free" (odd count)
// or "two more, one free" (even). Prices in lei; adds through roCartLine like every Romanian add-to-cart. Other carts: nothing.
export function RoCartCrossSell() {
  const items = useRoCart((s) => s.items);
  const addItem = useRoCart((s) => s.addItem);
  const stock = useLeatherStock(true);
  const [added, setAdded] = useState<string | null>(null);
  const bestSellers = useCollectionBestSellers(items.length > 0); // the collection's most sold pieces (orders, last 14 days)

  const opo = opoCrossSell(items.map((i) => ({ slug: i.slug, unit: i.ron, quantity: i.quantity, onSale: i.onSale })));
  if (!opo) return null;
  const available = (slug: string) => {
    const p = getProductBySlug(slug);
    return !!p && p.inStock && RO_SLUGS.includes(slug) && (stock?.[slug] ?? 1) > 0;
  };
  // Women's collection, odd count: the next piece is free - the 3 suggestions + the full grid (components/cart/CartFreeJewel.tsx).
  if (opo.group.id === "jewellery" && opo.odd) {
    const held = (slug: string) => items.filter((i) => i.slug === slug).reduce((n, i) => n + i.quantity, 0);
    const canAdd = (slug: string) => {
      const p = getProductBySlug(slug);
      return !!p && p.inStock && pieceLive(slug) && RO_SLUGS.includes(slug) && (stock?.[slug] ?? p.stock ?? 1) > held(slug);
    };
    const all: FreeJewelItem[] = COLLECTION_PIECES.flatMap(({ slug }) => {
      const raw = getProductBySlug(slug);
      const group = collectionGroupOf(slug);
      if (!raw || !group || !pieceLive(slug) || !RO_SLUGS.includes(slug)) return [];
      const p = localizeProduct(raw);
      return [{ slug, name: p.name, image: p.coverImage, group, available: canAdd(slug), priceText: fmtRON(ronOf(p)) }];
    });
    const top = collectionCartTop3(items.map((i) => i.slug), canAdd, bestSellers)
      .flatMap(({ slug, tag }) => { const item = all.find((i) => i.slug === slug); return item ? [{ item, tag }] : []; });
    const addFree = (slug: string) => { const raw = getProductBySlug(slug); if (raw) addItem(roCartLine(localizeProduct(raw), stock?.[slug])); };
    return <CartFreeJewel title="Adăugați a doua bijuterie – gratuit" top={top} all={all} text={FREE_JEWEL_RO} onAdd={addFree} />;
  }

  // Women's collection, even count: nothing (owner, 08.11.2026 - the free-piece block simply disappears once the pair is complete).
  if (opo && opo.group.id === "jewellery" && !opo.odd) return null;

  const suggestions = opoSuggestions(opo.group, items.map((i) => i.slug), available)
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p)
    .map(localizeProduct);
  if (suggestions.length === 0) return null;

  return (
    <div data-testid="cart-cross-sell" data-group={opo.group.id} className="mt-4 pt-4 border-t border-border">
      <p className="font-sans text-[13px] font-semibold text-navy mb-3">{opo.group.text.ro.crossSell[opo.odd ? "odd" : "even"]}</p>
      <div className="flex flex-col gap-3">
        {suggestions.map((p) => {
          const isAdded = added === p.slug;
          return (
            <div key={p.slug} className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0 bg-white border border-border overflow-hidden">
                <Image src={p.coverImage.src} alt={p.coverImage.alt} fill quality={60} sizes="48px" className="object-contain p-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[13px] text-navy leading-snug truncate">{p.name}</p>
                <p className="font-sans text-[12px] text-ink-muted mt-0.5">{fmtRON(ronOf(p))}</p>
              </div>
              <button
                onClick={() => {
                  addItem(roCartLine(p, stock?.[p.slug]));
                  setAdded(p.slug);
                  setTimeout(() => setAdded(null), 2000);
                }}
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center border transition-all duration-200 ${
                  isAdded ? "bg-navy border-navy text-white" : "border-navy/30 text-navy hover:border-navy"
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
