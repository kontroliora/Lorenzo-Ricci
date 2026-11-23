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
import { NEW_COLLECTION_SLUGS, COLLECTION_PIECES, collectionCartTop3, collectionGroupOf, pieceLive } from "@/lib/new-collection";
import { useCollectionBestSellers } from "@/lib/use-best-sellers";
import { CartFreeJewel, FREE_JEWEL_BG, type FreeJewelItem } from "./CartFreeJewel";
import { WATCH_JEWEL, cartHasWatch } from "@/lib/watch-jewel";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { giftDisplayName } from "@/lib/gifts";

// The name a suggestion shows: a cardholder as "Кардхолдър Onice" (its catalog name is 'Lorenzo Ricci "Onice"'), anything else as is.
const suggestionName = (p: Product): string => (p.category === "cardholders" ? giftDisplayName(p.slug) : p.name);

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

// What the cart suggests follows what is in it (owner, 23.11.2026), first match wins:
//   0. exactly 1 women's collection piece -> "Добавете второ бижу – безплатно" (the 1+1 free piece, as before)
//   1. a watch                          -> "Допълнете визията", men's pieces at €19 (lib/watch-jewel.ts)
//   2. 2+ women's collection pieces     -> "Подарък за него": one crocodile cardholder + one men's bracelet, current prices,
//                                          no more women's pieces
//   3. leather goods only               -> the women's Verdis pieces (1+1)
//   4. anything else                    -> the usual pairings; next to a clutch / wallet, men's pieces only under "Подарък за него"
const FOR_HIM_TITLE = "Подарък за него";
/** Darkest colours first: the first one in stock is offered. */
const FOR_HIM_CARDHOLDERS = ["cardholder-onice", "cardholder-zaffiro", "cardholder-perla", "cardholder-giada", "cardholder-marina"];
const FOR_HIM_BRACELETS = ["bracelet-milano-twist", "bracelet-signature", "bracelet-milano-forte", "bracelet-diamante-cross"];
const VERDIS_PIECES = ["necklace-verdis-gold", "bracelet-verdis-gold", "necklace-verdis-silver", "bracelet-verdis-silver"];
const VERDIS_TITLE = "Дамски бижута Verdis · 1+1 безплатно";
const LEATHER = new Set(["wallets", "cardholders", "bags"]);
/** Men's pieces: the jewellery outside the women's collection. */
const isMensJewel = (p: Product) => p.category === "jewellery" && !NEW_COLLECTION_SLUGS.has(p.slug);

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
  // No live stock numbers (still loading, or the request failed): no suggestions at all, so a sold-out product is never offered
  // (owner, 23.11.2026). The block appears as soon as the numbers arrive.
  if (!stock) return null;

  const cartIds = items.map((i) => i.product.id);
  const available = (slug: string) => { const p = getProductBySlug(slug); return !!p && p.inStock && (stock?.[slug] ?? 1) > 0; };
  // A cart with items of a running 1+1 group (the new jewellery, the cardholders): more of that same group - the next one is free
  // (odd count) or one of the next two is (even). Anything else: the usual pairings below.
  const opo = opoCrossSell(opoLines(items));
  const womenUnits = items.filter((i) => NEW_COLLECTION_SLUGS.has(i.product.slug)).reduce((n, i) => n + i.quantity, 0);
  const suggestionIds = opo ? opoSuggestions(opo.group, items.map((i) => i.product.slug), available) : computeSuggestions(cartIds);
  const title = opo ? opo.group.text.bg.crossSell[opo.odd ? "odd" : "even"] : "Често поръчвано заедно";

  // 0. An ODD number of women's collection pieces (1, 3, 5 ... - owner, 23.11.2026): the next piece is free - the 3 suggestions + the
  // full grid (components/cart/CartFreeJewel.tsx). An even number (every 1+1 is taken): "Подарък за него" below. This rule comes
  // before the watch's "Допълнете визията" when the cart holds both.
  if (opo && opo.group.id === "jewellery" && womenUnits % 2 === 1) {
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
    return <CartFreeJewel title={womenUnits === 1 ? "Добавете второ бижу – безплатно" : "Добавете още едно – безплатно"} top={top} all={all} text={FREE_JEWEL_BG} onAdd={addFree} />;
  }

  // 1. A watch in the cart: "Допълнете визията" (lib/watch-jewel.ts) replaces the usual watch pairings - men's pieces at €19, in
  // stock and not in the cart yet.
  if (cartHasWatch(items) && womenUnits === 0) {
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

  const slugs = items.map((i) => i.product.slug);
  const pick = (list: string[], n: number, ok: (slug: string) => boolean = available) =>
    list.filter((slug) => ok(slug) && !slugs.includes(slug)).slice(0, n);
  let heading = title;
  let chosen: string[];
  if (items.some((i) => NEW_COLLECTION_SLUGS.has(i.product.slug))) {
    // 2. Women's collection pieces: a gift for him, never more women's pieces.
    heading = FOR_HIM_TITLE;
    chosen = [...pick(FOR_HIM_CARDHOLDERS, 1), ...pick(FOR_HIM_BRACELETS, 1)];
  } else if (opo) {
    // Another running 1+1 group (e.g. the cardholders, when switched on): more of that group.
    chosen = suggestionIds;
  } else if (items.every((i) => LEATHER.has(i.product.category))) {
    // 3. Leather goods only: the women's Verdis pieces (1+1).
    heading = VERDIS_TITLE;
    chosen = pick(VERDIS_PIECES, 3, (slug) => available(slug) && pieceLive(slug));
  } else {
    chosen = suggestionIds;
  }

  const suggestions = chosen
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => !!p && available(p.slug))
    .map(applyOverride);
  // 4. Men's pieces next to a women's clutch / wallet only as a gift for him.
  if (heading === title && items.some((i) => i.product.category === "bags" || i.product.category === "wallets") && suggestions.some(isMensJewel))
    heading = FOR_HIM_TITLE;
  const strong = !!opo || heading !== "Често поръчвано заедно";

  if (suggestions.length === 0) return null;

  const handleAdd = (product: Product) => {
    addItem({ ...product, stock: stock?.[product.slug] ?? product.stock });
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
      {strong ? (
        <p className="font-sans text-[13px] font-semibold text-navy mb-3">{heading}</p>
      ) : (
        <p className="font-sans text-[10px] font-medium tracking-[0.2em] uppercase text-ink-muted mb-3">{heading}</p>
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
                  {suggestionName(product)}
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
