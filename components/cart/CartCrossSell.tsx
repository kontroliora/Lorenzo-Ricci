"use client";
import { useState } from "react";
import { useLeatherStock } from "@/lib/use-gifts";
import Image from "next/image";
import { useCartStore } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import { usePriceOverrides } from "@/lib/use-price-overrides";
import type { Product } from "@/lib/types";
import { isOnSale } from "@/lib/price";

// The cart's € format (same as the line items): no ",00", comma for cents.
const eur = (n: number): string => `€${Number.isInteger(Math.round(n * 100) / 100) ? Math.round(n) : n.toFixed(2).replace(".", ",")}`;
import { opoLines } from "@/lib/bundles";
import { opoCrossSell, opoSuggestions } from "@/lib/one-plus-one";
import { COLLECTION_PIECES, collectionCartTop3, collectionGroupOf, pieceLive } from "@/lib/new-collection";
import { useCollectionBestSellers } from "@/lib/use-best-sellers";
import { CartFreeJewel, FREE_JEWEL_BG, type FreeJewelItem } from "./CartFreeJewel";
import { WATCH_JEWEL, cartHasWatch } from "@/lib/watch-jewel";
import { trackWithCapi, genEventId } from "@/lib/fbq";

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

  // Carts with a watch never get here: "Допълнете визията" (lib/watch-jewel.ts) replaces their pairings.
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
  const bestSellers = useCollectionBestSellers(items.length > 0); // the collection's most sold pieces (orders, last 14 days)

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
    const top = collectionCartTop3(items.map((i) => i.product.slug), canAdd, bestSellers)
      .flatMap(({ slug, tag }) => { const item = all.find((i) => i.slug === slug); return item ? [{ item, tag }] : []; });
    const addFree = (slug: string) => { const p = getProductBySlug(slug); if (p) addItem({ ...applyOverride(p), stock: stock?.[slug] ?? p.stock }); };
    return <CartFreeJewel title="Добавете второ бижу – безплатно" top={top} all={all} text={FREE_JEWEL_BG} onAdd={addFree} />;
  }

  // A watch in the cart: "Допълнете визията" (lib/watch-jewel.ts) replaces the usual watch pairings - men's pieces at €19, in stock
  // and not in the cart yet. Only the women's free-piece block above comes first.
  if (cartHasWatch(items)) {
    const picks = WATCH_JEWEL.slugs
      .filter((slug) => available(slug) && !items.some((i) => i.product.slug === slug))
      .slice(0, 3)
      .flatMap((slug) => { const raw = getProductBySlug(slug); return raw ? [applyOverride(raw)] : []; });
    if (picks.length === 0) return null;
    const addJewel = (p: Product) => {
      addItem({ ...p, stock: stock?.[p.slug] ?? p.stock });
      setAddedIds((prev) => new Set(prev).add(p.id));
      setTimeout(() => setAddedIds((prev) => { const next = new Set(prev); next.delete(p.id); return next; }), 2000);
      trackWithCapi("AddToCart", {
        content_ids: [p.sku], content_name: p.name, content_type: "product",
        value: Math.min(p.price, WATCH_JEWEL.price), currency: "EUR", num_items: 1,
      }, genEventId("ATC"));
    };
    return (
      <div data-testid="watch-jewel" className="pt-4">
        <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-ink-muted">Допълнете визията</p>
        <p className="font-sans text-[12px] text-ink-soft mt-1 mb-3">Специална цена към вашия часовник</p>
        <div className="flex flex-col gap-3">
          {picks.map((p) => {
            const deal = p.price > WATCH_JEWEL.price;
            return (
              <div key={p.id} data-slug={p.slug} className="flex items-center gap-3">
                <div className="relative w-12 h-12 flex-shrink-0 bg-white border border-border overflow-hidden">
                  <Image src={p.coverImage.src} alt={p.coverImage.alt} fill quality={60} sizes="48px" className="object-contain p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-[13px] text-navy leading-snug truncate">{p.name}</p>
                  <p data-testid="watch-jewel-price" className="font-sans text-[12px] mt-0.5 flex gap-2">
                    {deal && <span className="text-ink-muted line-through">{eur(p.price)}</span>}
                    <span className="text-navy font-semibold">{eur(deal ? WATCH_JEWEL.price : p.price)}</span>
                  </p>
                </div>
                <button
                  onClick={() => addJewel(p)}
                  data-testid="watch-jewel-add"
                  className="flex-shrink-0 min-h-[40px] min-w-[84px] px-4 bg-navy text-white font-sans text-[11px] tracking-[0.14em] uppercase hover:bg-navy-light transition-colors"
                  aria-label={`Добави ${p.name}`}
                >
                  {addedIds.has(p.id) ? "✓ Добавено" : "+ Добави"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Women's collection, even count: nothing (owner, 08.11.2026 - the free-piece block simply disappears once the pair is complete).
  if (opo && opo.group.id === "jewellery" && !opo.odd) return null;

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
    <div data-testid="cart-cross-sell" data-group={opo?.group.id ?? ""} className="pt-4">
      {opo ? (
        <p className="font-sans text-[13px] font-semibold text-navy mb-3">{title}</p>
      ) : (
        <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-ink-muted mb-3">{title}</p>
      )}
      <div className="flex flex-col gap-3">
        {suggestions.map((product) => {
          const isAdded = addedIds.has(product.id);
          return (
            <div key={product.id} className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0 bg-white border border-border overflow-hidden">
                <Image
                  src={product.coverImage.src}
                  alt={product.coverImage.alt}
                  fill
                  quality={60}
                  sizes="48px"
                  className="object-contain p-0.5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[13px] text-navy leading-snug truncate">
                  {product.name}
                </p>
                <p data-testid="cross-price" className="font-sans text-[12px] mt-0.5 flex gap-2">
                  {isOnSale(product) && <span className="text-ink-muted line-through">{eur(product.originalPrice as number)}</span>}
                  <span className="text-navy font-semibold">{eur(product.price)}</span>
                </p>
              </div>
              <button
                onClick={() => handleAdd(product)}
                data-testid="cross-add"
                className="flex-shrink-0 min-h-[40px] min-w-[84px] px-4 bg-navy text-white font-sans text-[11px] tracking-[0.14em] uppercase hover:bg-navy-light transition-colors"
                aria-label={`Добави ${product.name}`}
              >
                {isAdded ? "✓ Добавено" : "Добави"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
