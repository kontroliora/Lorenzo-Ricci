"use client";
import { useState } from "react";
import { useLeatherStock } from "@/lib/use-gifts";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import { usePriceOverrides } from "@/lib/use-price-overrides";
import type { Product } from "@/lib/types";
import { opoLines } from "@/lib/bundles";
import { opoCrossSell, opoSuggestions } from "@/lib/one-plus-one";
import { COLLECTION_PIECES, collectionCartTop3, collectionGroupOf, pieceLive } from "@/lib/new-collection";
import { CartFreeJewel, FREE_JEWEL_BG, type FreeJewelItem } from "./CartFreeJewel";

const WALLET_FOR_CARDHOLDER: Record<string, string> = {
  "cardholder-bianco":     "wallet-alabastro",
  "cardholder-valentina":  "wallet-rubino",
  "cardholder-ambra":      "wallet-rubino",
  "cardholder-zaffiro":    "wallet-alabastro",
  "cardholder-onice":      "wallet-alabastro",
  "cardholder-giada":      "wallet-alabastro",
  "cardholder-cremisi":    "wallet-rubino",
  "cardholder-perla":      "wallet-alabastro",
  "cardholder-topazio":    "wallet-alabastro",
  "cardholder-marina":     "wallet-alabastro",
  "cardholder-panna":      "wallet-alabastro",
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
  "bracelet-milano-twist",
  "bracelet-milano-forte",
  "bracelet-signature",
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
  const applyOverride = usePriceOverrides();
  const stock = useLeatherStock(true);   // live counts: a product at 0 is never suggested (owner, 28.10.2026)

  if (items.length === 0) return null;

  const cartIds = items.map((i) => i.product.id);
  const available = (slug: string) => { const p = getProductBySlug(slug); return !!p && p.inStock && (stock?.[slug] ?? 1) > 0; };
  // A cart with items of a running 1+1 group (the new jewellery, the cardholders): more of that same group - the next one is free
  // (odd count) or one of the next two is (even). Anything else: the usual pairings below.
  const opo = opoCrossSell(opoLines(items));
  const suggestionIds = opo ? opoSuggestions(opo.group, items.map((i) => i.product.slug), available) : computeSuggestions(cartIds);
  const title = opo ? opo.group.text.bg.crossSell[opo.odd ? "odd" : "even"] : "Често поръчвано заедно";

  // Women's collection, odd count: the next piece is free - the 3 suggestions + the full grid (components/cart/CartFreeJewel.tsx).
  if (opo && opo.group.id === "jewellery" && opo.odd) {
    const held = (slug: string) => items.filter((i) => i.product.slug === slug).reduce((n, i) => n + i.quantity, 0);
    const canAdd = (slug: string) => {
      const p = getProductBySlug(slug);
      return !!p && p.inStock && pieceLive(slug) && (stock?.[slug] ?? p.stock ?? 1) > held(slug);
    };
    const all: FreeJewelItem[] = COLLECTION_PIECES.flatMap(({ slug }) => {
      const raw = getProductBySlug(slug);
      const group = collectionGroupOf(slug);
      if (!raw || !group || !pieceLive(slug)) return [];
      const p = applyOverride(raw);
      return [{ slug, name: p.name, image: p.coverImage, group, available: canAdd(slug),
        priceText: `€${Number.isInteger(p.price) ? p.price : p.price.toFixed(2).replace(".", ",")}` }];
    });
    const top = collectionCartTop3(items.map((i) => i.product.slug), canAdd)
      .flatMap(({ slug, tag }) => { const item = all.find((i) => i.slug === slug); return item ? [{ item, tag }] : []; });
    const addFree = (slug: string) => { const p = getProductBySlug(slug); if (p) addItem({ ...applyOverride(p), stock: stock?.[slug] ?? p.stock }); };
    return <CartFreeJewel title={title} top={top} all={all} text={FREE_JEWEL_BG} onAdd={addFree} />;
  }

  const suggestions = suggestionIds
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p && available(p.slug))
    .map(applyOverride);

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
    <div data-testid="cart-cross-sell" data-group={opo?.group.id ?? ""} className="mt-2 pt-4 border-t border-white/8">
      {opo ? (
        <p className="font-sans text-xs text-[#D4AF37] tracking-wide mb-3">◈ {title}</p>
      ) : (
        <p className="font-sans text-[9px] font-medium tracking-[0.28em] uppercase text-white/35 mb-3">{title}</p>
      )}
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
                  quality={60}
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
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center border transition-all duration-200 ${
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
