"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, RefreshCw, Truck, Eye } from "lucide-react";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { reviewSummary } from "@/lib/reviews";
import { useCountry } from "@/lib/country";
import { displayPrice, requiresPrepayment } from "@/lib/price";
import { PayLine, CodLine } from "@/components/product/CodNote";
import { StickyCartBar } from "@/components/product/StickyCartBar";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments";
import { GiftOffer } from "@/components/product/GiftOffer";
import { trackFbEvent, trackWithCapi, genEventId } from "@/lib/fbq";
import { getProductBySlug } from "@/lib/products";
import { PAGE_LOW_STOCK_MAX, savingsEur } from "@/lib/home-card-hints";
import { campaignLabel } from "@/lib/sale-campaign";
import { BG_FREE_SHIPPING_EUR, bgShipsFree } from "@/lib/shipping-rules";
import { SavingsLine, DeliveryLine, OnePlusOneLine, OnePlusOneBadge, FreeShippingBadge, BoxLine, WarrantyLine } from "@/components/product/PriceExtras";
import { OnePlusOnePicker, type PickOption } from "@/components/product/OnePlusOnePicker";
import { ProductDetails } from "@/components/product/ProductDetails";
import { collectionSwatches, isCollectionSlug, type ModelRow } from "@/lib/new-collection";
import { CollectionModelRow } from "@/components/product/CollectionModelRow";
import { opoGroupOf, opoPriceLineBg, opoPairPrice, opoPairPriceBg } from "@/lib/one-plus-one";
import { useLeatherStock } from "@/lib/use-gifts";

// A colour swatch reads as sold out when its product is switched off in
// lib/products.ts (inStock: false - the owner's single on/off switch); the
// hand-written inStock flags in the variant lists below are only a fallback.
const variantOff = (v: { slug: string; inStock: boolean }) => !(getProductBySlug(v.slug)?.inStock ?? v.inStock);

// Colour switching must feel instant on phones. Two things make it slow by
// default: the product route is dynamic (the root layout reads geo headers), so a
// tap normally waits for a server render; and the new colour's big photo is
// fetched only after that. <Link prefetch> handles the route; this fetches the
// other colour's main photo at the exact size this device already loaded, so it
// paints from cache after the tap. Deduped per slug for the page's lifetime.
// Renders a description paragraph, turning **text** into <strong> spans and line breaks into
// <br>. Sections' `body` is plain owner-supplied copy (not full markdown) — this only exists so
// pasted "**bold**" phrases and line breaks render correctly instead of showing raw asterisks.
function BoldedText({ text }: { text: string }) {
  // [\s\S] instead of the `s` flag: the project targets ES2017, where dotAll fails to compile.
  const parts = text.split(/\*\*([\s\S]+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => {
        const lines = part.split("\n");
        const withBreaks = lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {line}
          </span>
        ));
        return i % 2 === 1 ? (
          <strong key={i} className="font-medium text-charcoal">{withBreaks}</strong>
        ) : (
          <span key={i}>{withBreaks}</span>
        );
      })}
    </>
  );
}

const prefetchedSlugs = new Set<string>();
function prefetchMainImage(slug: string) {
  if (prefetchedSlugs.has(slug)) return;
  const p = getProductBySlug(slug);
  if (!p) return;
  const src = p.images[0]?.src ?? p.coverImage.src;
  // The gallery's main <img>: its currentSrc carries the w= and q= the browser chose.
  const gallery = document.querySelector<HTMLImageElement>('img[sizes="(max-width: 640px) 100vw, 60vw"]');
  const current = gallery?.currentSrc || gallery?.src;
  if (!current || !current.includes("/_next/image?")) return;
  prefetchedSlugs.add(slug);
  const img = new Image();
  img.setAttribute("fetchpriority", "low");
  img.src = current.replace(/([?&]url=)[^&]*/, `$1${encodeURIComponent(src)}`);
}

// Grouped, not one flat list: a product's swatch row is whichever group its own
// slug belongs to, so the Yachting trio switches only among itself and the
// original three do the same - adding a collection here never bleeds into the
// others' product pages. Same swatch UI/Link pattern either way (see below).
const WATCH_VARIANT_GROUPS = [
  [
    { slug: "chrono-black",   label: "Black", color: "#111111", inStock: true },
    { slug: "golden-eclipse", label: "Gold",  color: "#C9A84C", inStock: true },
    { slug: "polar-frost",    label: "Blue",  color: "#5B8DB8", inStock: true },
  ],
  [
    { slug: "yachting-black", label: "Black", color: "#111111", inStock: true },
    { slug: "yachting-blue",  label: "Blue",  color: "#1C3450", inStock: true },
    { slug: "yachting-white", label: "White", color: "#FFFFFF", inStock: true },
  ],
];

const WALLET_VARIANTS = [
  { slug: "wallet-alabastro", label: "Alabastro - Бял",  color: "#E8E0D4", inStock: true  },
  { slug: "wallet-rubino",    label: "Rubino - Червен", color: "#8B1F1F", inStock: true  },
  { slug: "wallet-smeraldo",  label: "Smeraldo - Зелен", color: "#2A4A1E", inStock: false },
];

const CARDHOLDER_VARIANTS = [
  { slug: "cardholder-ambra",     label: "Ambra - Оранжев",    color: "#C47A1A", inStock: true },
  { slug: "cardholder-bianco",    label: "Bianco - Бял",       color: "#E8E4DC", inStock: true },
  { slug: "cardholder-valentina", label: "Valentina - Розов",  color: "#C44B8A", inStock: true },
  { slug: "cardholder-zaffiro",   label: "Zaffiro - Тъмносин", color: "#1A2B4A", inStock: true },
  // 2026-09-27 batch - swatches sampled from each product's own front photo.
  { slug: "cardholder-onice",     label: "Onice - Черен",      color: "#1B1818", inStock: true },
  { slug: "cardholder-giada",     label: "Giada - Тъмнозелен", color: "#1F362B", inStock: true },
  { slug: "cardholder-cremisi",   label: "Cremisi - Червен",   color: "#BD0F1A", inStock: true },
  { slug: "cardholder-perla",     label: "Perla - Сив",        color: "#A99B8F", inStock: true },
  { slug: "cardholder-topazio",   label: "Topazio - Жълт",     color: "#E4AB05", inStock: true },
  { slug: "cardholder-marina",    label: "Marina - Син",       color: "#1B5A80", inStock: true },
  { slug: "cardholder-panna",     label: "Panna - Кремаво бял", color: "#EFE7D6", inStock: true },
];

// Evening clutches (the Milano Avorio bag is a one-off and has no siblings).
const CLUTCH_VARIANTS = [
  { slug: "clutch-torino",    label: "Torino - Черен",        color: "#1B1818", inStock: true },
  { slug: "clutch-verona",    label: "Verona - Бордо",        color: "#6B1F2B", inStock: true },
  { slug: "clutch-toscana",   label: "Toscana - Тъмнозелен",  color: "#1F3A2E", inStock: true },
  { slug: "clutch-portofino", label: "Portofino - Кремав",    color: "#EFE6D6", inStock: true },
  { slug: "clutch-capri",     label: "Capri - Тъмносин",      color: "#1F2D4F", inStock: true },
];

// Viber quick-order deep link - opens a 1:1 chat with the store number.
// Format verified against the de-facto standard: viber://chat?number=<E.164>,
// tappable on iOS/Android. %2B is the encoded leading "+".
const VIBER_LINK = "viber://chat?number=%2B359888081811";

// Product-page Viber quick-order button. Hidden for now - flip to `true` to
// bring it back (nothing is deleted).
const SHOW_VIBER = false;

// Show the low-stock line only when AVAILABLE units are at or below PAGE_LOW_STOCK_MAX (lib/home-card-hints.ts).

interface ProductInfoProps {
  product: Product;
  reviewCount?: number;
  modelRow?: ModelRow | null; // women's collection: "Камък" / "Камъни" row (lib/new-collection.ts collectionModelRow)
}

export function ProductInfo({ product, reviewCount = 0, modelRow = null }: ProductInfoProps) {
  const { addItem, items: cartItems } = useCartStore();
  const [added, setAdded] = useState(false);
  // 1+1 group: the free second item picked on the page (null = none; may be this same model)
  const [pick, setPick] = useState<string | null>(null);
  const opoStock = useLeatherStock(!!opoGroupOf(product.slug)); // the group's live stock (one batched call)
  // A product with no description content (e.g. the Yachting watches until they're
  // measured) gets no Описание tab and opens on the specs instead of an empty tab.
  const hasDescription = Boolean(
    product.descriptionSections?.length || product.tabDescription?.length ||
    product.description.trim(),
  );
  const tabs: readonly ("description" | "specs" | "delivery")[] = hasDescription
    ? ["description", "specs", "delivery"]
    : ["specs", "delivery"];
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "delivery">(hasDescription ? "description" : "specs");
  const [walletStock, setWalletStock] = useState<number | null>(null);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  const variants =
    product.category === "watches"
      ? (WATCH_VARIANT_GROUPS.find((g) => g.some((v) => v.slug === product.slug)) ?? WATCH_VARIANT_GROUPS[0])
      : product.category === "wallets" ? WALLET_VARIANTS
      : product.category === "cardholders" ? CARDHOLDER_VARIANTS
      : product.category === "bags" && product.slug !== "bag-milano-avorio" ? CLUTCH_VARIANTS // the one-off bag has no siblings
      : product.category === "jewellery" && collectionSwatches(product.slug, "bg").length > 0 ? collectionSwatches(product.slug, "bg") // 2026 collection: gold / silver
      : null;

  // Small colour groups (watches, wallets: 3): warm the other colours' main photo
  // once the page has settled. Big groups (cardholders: 11) only on touch/hover,
  // so a phone doesn't download eight large photos it may never look at.
  useEffect(() => {
    if (!variants || variants.length > 4) return;
    const others = variants.filter((v) => v.slug !== product.slug);
    const id = window.setTimeout(() => others.forEach((v) => prefetchMainImage(v.slug)), 1500);
    return () => window.clearTimeout(id);
  }, [variants, product.slug]);

  // ALL sellable categories read the live available number (/api/stock =
  // KV − reserved for watches/jewellery, wallet_inventory for leather) - same as
  // the admin panel. So a product at 0 available shows "Изчерпан" + a locked
  // button automatically, for every category (no manual per-product flag).
  const hasInventory =
    product.category === "watches" ||
    product.category === "jewellery" ||
    product.category === "wallets" ||
    product.category === "cardholders" ||
    product.category === "bags";

  // Leather goods get one extra bullet (5 vs 4) - their copy needs room for both
  // the hide/relief description and the construction/format lines. Watches and
  // jewellery stay at 4.
  const isLeatherGoods =
    product.category === "wallets" ||
    product.category === "cardholders" ||
    product.category === "bags";
  const featuresLimit = isLeatherGoods ? 5 : 4;

  useEffect(() => {
    const pick = () => {
      const r = Math.random();
      if (r < 0.12) return 2;
      if (r < 0.80) return 3 + Math.floor(Math.random() * 6);
      return 9 + Math.floor(Math.random() * 6);
    };
    let current = pick();
    setViewerCount(current);
    let timerId: number;
    const schedule = () => {
      timerId = window.setTimeout(() => {
        const drift = 1 + Math.floor(Math.random() * 2);
        const dir = Math.random() < 0.5 ? -1 : 1;
        current = Math.min(14, Math.max(2, current + dir * drift));
        setViewerCount(current);
        schedule();
      }, 45000 + Math.random() * 15000);
    };
    schedule();
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!hasInventory) return;
    fetch(`/api/stock/${product.slug}`)
      .then((r) => r.json())
      .then((d) => {
        setWalletStock(typeof d.stock === "number" ? d.stock : null);
        setStockLoaded(true);
      })
      .catch(() => setStockLoaded(true));
  }, [product.slug, hasInventory]);

  // inStock: false in lib/products.ts is the owner's hard off switch ("not for
  // sale"), whatever the count says; otherwise the live count decides (0 = sold
  // out), and with no live number the product counts as available.
  const liveCount = hasInventory && stockLoaded && walletStock !== null ? walletStock : null;
  const effectiveInStock = product.inStock && (liveCount === null || liveCount > 0);
  // What the stock hint shows: a switched-off product reads as 0 ("Изчерпан").
  const shownCount = product.inStock ? liveCount : 0;

  // Cap the cart quantity at the LIVE stock (not the static products.ts value)
  // for leather goods, so the +/− stepper and re-adds can't exceed what we hold.
  const effectiveStock =
    hasInventory && stockLoaded && walletStock !== null ? walletStock : product.stock;

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_ids:  [product.sku],
      content_name: product.name,
      content_type: "product",
      value:        product.price,
      currency:     "EUR", // Meta needs the ISO code; product.currency is the display symbol
    });
  }, [product.slug]);

  const price = displayPrice(product, useCountry());
  // Under the price: the saving while the struck EUR price is shown (not on a sold-out product) with the running campaign's badge.
  const saved = price.original && effectiveInStock ? savingsEur(product) : null;
  const campaign = campaignLabel();
  // Beside it: the free-delivery badge when the product alone reaches the threshold (not on a sold-out product).
  const shipsFree = effectiveInStock && bgShipsFree(product);

  // ── 1+1 (lib/one-plus-one.ts): the group's models, each available when its live stock, less what the cart already holds, covers
  //    it (the page's own model needs 2 for "the same one again"). A pick that stops being available is dropped.
  const opo = effectiveInStock ? opoGroupOf(product.slug) : undefined;
  const inCart = (slug: string) => cartItems.find((i) => i.product.slug === slug)?.quantity ?? 0;
  const freeLeft = (slug: string): number => {
    const p = getProductBySlug(slug);
    if (!p || !p.inStock) return 0;
    const live = slug === product.slug ? effectiveStock : (opoStock?.[slug] ?? p.stock);
    return (typeof live === "number" ? live : Infinity) - inCart(slug);
  };
  const pickOptions: PickOption[] = opo
    ? [...opo.slugs].flatMap((slug) => {
        const p = getProductBySlug(slug);
        if (!p) return [];
        return [{ slug, name: opo.text.bg.shortName(p.name), image: p.coverImage, available: freeLeft(slug) >= (slug === product.slug ? 2 : 1) && freeLeft(product.slug) >= 1 }];
      })
    : [];
  const picked = opo && pick ? pickOptions.find((o) => o.slug === pick && o.available) ?? null : null;
  useEffect(() => { setPick(null); }, [product.slug]);
  // The pair costs the dearer of the two (the cheaper one is free): €65 for two cardholders, €109 / €115 for jewellery.
  const pickedPrice = picked ? (getProductBySlug(picked.slug)?.price ?? product.price) : product.price;
  const pairLabel = picked && opo ? opo.text.bg.addPair({ one: opoPairPriceBg(product.price, pickedPrice) }) : null;

  const handleAdd = () => {
    addItem({ ...product, stock: effectiveStock });
    const second = picked ? getProductBySlug(picked.slug) : undefined;
    if (second) addItem(second.slug === product.slug ? { ...product, stock: effectiveStock } : { ...second, stock: opoStock?.[second.slug] ?? second.stock });
    setAdded(true);
    setPick(null);
    setTimeout(() => setAdded(false), 2000);
    trackWithCapi("AddToCart", {
      content_ids:  second ? [product.sku, second.sku] : [product.sku],
      content_name: second ? `${product.name} + ${second.name}` : product.name,
      content_type: "product",
      value:        second ? opoPairPrice(product.price, second.price) : product.price, // the cheaper one is free
      currency:     "EUR",
      num_items:    second ? 2 : 1,
    }, genEventId("ATC"));
  };

  const handleViberClick = () => {
    trackFbEvent("Contact", {
      content_ids:  [product.sku],
      content_name: product.name,
      content_type: "product",
    });
  };

  // The add-to-cart button and its payment line (placed under the picker for a women's-collection piece, else lower down).
  const inCollection = isCollectionSlug(product.slug);
  const cta = (
    <>
    <button
      data-main-cta="true"
      onClick={effectiveInStock ? handleAdd : undefined}
      disabled={!effectiveInStock}
      className={`w-full justify-center text-center ${
        effectiveInStock
          ? "btn-primary"
          : "font-sans text-[11px] tracking-[0.22em] uppercase px-8 py-4 bg-ink-faint/20 text-ink-muted border border-border cursor-not-allowed"
      }`}
    >
      {!effectiveInStock
        ? "ИЗЧЕРПАНА НАЛИЧНОСТ"
        : added
        ? "✓ ДОБАВЕНО В КОЛИЧКАТА"
        : pairLabel ?? "ДОБАВИ В КОЛИЧКАТА"}
    </button>
  
    {effectiveInStock && !requiresPrepayment(product) && <CodLine text={CARD_PAYMENTS_ENABLED ? "Карта или наложен платеж · Доставка с Еконт" : "Без предплащане · Доставка с Еконт · Плащате при получаване"} />}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <p className="font-sans text-[10px] text-ink-muted tracking-widest uppercase">
        {product.category === "watches" ? "Часовници"
          : product.category === "wallets" ? "Портфейли"
          : product.category === "cardholders" ? "Кардхолдъри"
          : product.category === "bags" ? "Чанти"
          : "Бижута"} / {product.name}
      </p>

      {/* Name (no catalogue badge above it: the badges sit by the price) */}
      <div>
        <h1 className="font-serif text-display-md text-charcoal leading-tight">{product.name}</h1>
        <p className="font-sans text-[10px] text-ink-muted tracking-[0.2em] mt-1.5">
          Арт. {product.sku}
        </p>
      </div>

      {/* Color variant selector - watches, wallets, cardholders */}
      {variants && (
          <div className="flex items-center gap-3">
            <span className="font-sans text-[10px] text-ink-muted tracking-widest uppercase">Цвят:</span>
            <div className="flex flex-wrap items-center gap-2 min-w-0 [@media(pointer:coarse)]:gap-0">
              {variants.map((v) => (
                <Link
                  key={v.slug}
                  href={`/products/${v.slug}`}
                  title={v.label}
                  prefetch={true}
                  onTouchStart={() => prefetchMainImage(v.slug)}
                  onMouseEnter={() => prefetchMainImage(v.slug)}
                  aria-label={v.label}
                  className="flex items-center justify-center w-6 h-6 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:h-11"
                >
                  <span
                    className={`relative block w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                      product.slug === v.slug
                        ? "border-navy scale-110 shadow-[0_0_0_2px_rgba(15,40,80,0.15)]"
                        : "border-border hover:border-navy/40"
                    } ${variantOff(v) ? "opacity-50" : ""}`}
                    style={{ backgroundColor: v.color }}
                  >
                  {/* Diagonal strikethrough for out-of-stock */}
                  {variantOff(v) && (
                    <span
                      className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                      aria-label="Изчерпан"
                    >
                      <svg viewBox="0 0 24 24" className="w-full h-full">
                        <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                  </span>
                </Link>
              ))}
            </div>
          </div>
      )}

      {/* Women's collection: stone / stones row (other models, same type and metal) */}
      {modelRow && <CollectionModelRow row={modelRow} current={product.slug} hrefPrefix="/products/" onPrefetch={prefetchMainImage} />}

      {/* Rating */}
      {reviewCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="star-rating text-sm">★★★★★</div>
          <a
            href="#reviews"
            className="font-sans text-xs text-ink-muted tracking-wide hover:text-navy transition-colors [@media(pointer:coarse)]:py-3.5 [@media(pointer:coarse)]:-my-3.5"
          >
            {(reviewSummary[product.slug]?.avg ?? 4.8).toFixed(1)} · {reviewCount} {reviewCount === 1 ? "ревю" : "ревюта"}
          </a>
        </div>
      )}

      {/* Price */}
      <div className="py-5 border-y border-border">
        <div className={`flex ${opo ? "flex-wrap items-center gap-x-3 gap-y-2" : "items-baseline gap-4"}`}>
          <span className={`font-serif text-4xl text-navy ${opo ? "mr-1" : ""}`}>
            {price.text}
          </span>
          {/* Sale: the prior price (lowest of the last 30 days - lib/price.ts isOnSale) */}
          {price.original && (
            <span className="font-sans text-lg text-ink-muted line-through">
              {price.original}
            </span>
          )}
          {/* 1+1 group: the red badge right after the price, then the green free-delivery one */}
          {opo && <OnePlusOneBadge text={opo.text.bg.badge} />}
          {opo && shipsFree && <FreeShippingBadge text="Безплатна доставка" size="page" />}
        </div>
        <SavingsLine text={saved !== null ? `Спестявате €${saved}` : null} campaign={campaign} freeShipping={shipsFree && !opo ? "Безплатна доставка" : null} />
        {inCollection && <BoxLine text="Луксозна велурена кутия LORENZO RICCI" />}
        {inCollection && <WarrantyLine text="Доживотна гаранция" href={"/warranty/jewelry"} />}
        {/* 1+1 group (lib/one-plus-one.ts): "2 картодържателя за €65 ..." and the free second one, picked here */}
        {opo && <OnePlusOneLine badge={opo.text.bg.badge} line={opoPriceLineBg(product.slug)} size="page" />}
        {opo && (
          <OnePlusOnePicker title={opo.text.bg.pickTitle} options={pickOptions} selected={picked?.slug ?? null} onSelect={setPick} soldOutLabel="Изчерпан" />
        )}
      </div>

      {/* Women's collection: the button right after the picker */}
      {inCollection && cta}

      {/* Delivery in one line, right under the price; inspection before paying only where cash on delivery exists.
          The "free over €60" part only while the green badge doesn't already say it. */}
      {effectiveInStock && (
        <DeliveryLine
          text={`${shipsFree ? "" : `Безплатна доставка над €${BG_FREE_SHIPPING_EUR} · `}Доставка за 1–2 работни дни с Еконт${requiresPrepayment(product) ? "" : " · Преглед преди плащане"}`}
        />
      )}

      {/* How to pay, one line under the price (not for a prepayment product) */}
      {effectiveInStock && !requiresPrepayment(product) && (
        CARD_PAYMENTS_ENABLED
          ? <PayLine text="Плащане с карта (−5%) или при доставка" marks={true} />
          : <PayLine text="Наложен платеж" marks={false} />
      )}

      {/* Clutches: the free gift cardholder (renders nothing for any other product) */}
      <GiftOffer clutchSlug={product.slug} />

      {/* Stock indicator - the number AVAILABLE (free to order), matching the
          admin panel's "Налични". Shown only below the low-stock threshold; above
          it nothing is revealed (we don't disclose how much we hold). Premium and
          restrained - a quiet nudge, never a loud "HURRY". */}
      {shownCount !== null && shownCount <= PAGE_LOW_STOCK_MAX && (
        <div className="flex items-center gap-2">
          {shownCount === 0 ? (
            <>
              <span className="text-ink-muted text-xs">◈</span>
              <span className="font-sans text-[11px] text-ink-muted tracking-wide">Изчерпан</span>
            </>
          ) : product.slug === "bag-milano-avorio" ? (
            // A one-of-one is limited, not "running out".
            <>
              <span className="text-navy/70 text-xs">◈</span>
              <span className="font-sans text-[11px] text-navy tracking-wide font-medium">Лимитиран до 1 брой</span>
            </>
          ) : (
            <>
              <span className="text-amber-600/80 text-xs">◈</span>
              <span className="font-sans text-[11px] text-amber-700 tracking-wide font-medium">
                {shownCount === 1 ? "Остава последният брой" : `Остават само ${shownCount} броя`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Viewer count badge — shown only alongside the low-stock nudge so it
          reads as social proof rather than a standalone pressure tactic */}
      {viewerCount !== null && shownCount !== null && shownCount > 0 && shownCount <= PAGE_LOW_STOCK_MAX && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B5451B] animate-pulse flex-shrink-0" />
          <span className="font-sans text-[11px] text-[#B5451B] tracking-wide">
            {viewerCount} души разглеждат този продукт в момента
          </span>
        </div>
      )}

      {/* Features */}
      <ul className="flex flex-col gap-2.5">
        {product.features.slice(0, featuresLimit).map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <span className="text-navy mt-0.5 flex-shrink-0 text-xs">◈</span>
            <span className="font-sans font-light text-ink-soft leading-relaxed tracking-wide">{f}</span>
          </li>
        ))}
      </ul>

      {/* 2026 collection: "Детайли" rows that have a value + the box line (nothing for other products) */}
      <ProductDetails title="Детайли" rows={product.details} note={product.deliveryNote} />

      {/* Natural-variation note: above the CTA on desktop so it's read before ordering;
          on phones it sits right under the button instead (owner: a text block on top
          of the button reads badly there). Same text, one of the two renders. */}
      {product.materialNote && (
        <p className="hidden sm:block font-sans text-xs font-light text-ink-soft leading-relaxed tracking-wide border-l-2 border-navy/20 pl-3">
          {product.materialNote}
        </p>
      )}

      {/* CTA (a women's-collection piece has it right after the picker, further up) */}
      {!inCollection && cta}

      {/* Phones: the natural-variation note goes under the button (see above). */}
      {product.materialNote && (
        <p className="sm:hidden font-sans text-[11px] font-light text-ink-muted leading-relaxed tracking-wide">
          {product.materialNote}
        </p>
      )}

      {/* Viber quick order - hidden via SHOW_VIBER (flip the flag to bring it back) */}
      {SHOW_VIBER && (
      <div className="flex flex-col gap-3 -mt-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-faint/20" />
          <span className="font-sans text-[10px] text-ink-muted tracking-[0.18em] uppercase">или</span>
          <div className="flex-1 h-px bg-ink-faint/20" />
        </div>
        <a
          href={VIBER_LINK}
          onClick={handleViberClick}
          className="inline-flex w-full items-center justify-center gap-2.5 border border-[#7360F2]/40 text-charcoal font-sans font-light text-xs tracking-[0.22em] uppercase px-8 py-4 transition-all duration-300 hover:bg-[#7360F2]/[0.06] hover:border-[#7360F2]/70 active:scale-[0.98]"
        >
          <ViberIcon className="w-5 h-5 flex-shrink-0" />
          Поръчай директно по Viber
        </a>
        <p className="text-center font-sans text-[11px] text-ink-muted tracking-wide">
          или ни добавете: <span className="text-ink-soft">+359 888 081 811</span>
        </p>
      </div>
      )}

      <StickyCartBar product={product} effectiveInStock={effectiveInStock} onAdd={handleAdd} pairLabel={pairLabel} />

      {/* Trust strip */}
      <div className="grid grid-cols-2 gap-0 border border-border">
        {[
          {
            // Watches: 5-year commercial guarantee. Jewellery: lifetime. Leather: no
            // warranty is offered (owner, 2026-09-27), so the tile stays craftsmanship.
            label: product.category === "watches"
              ? "5 години търговска гаранция"
              : product.category === "jewellery"
              ? "Доживотна гаранция"
              : "Майсторска изработка",
            Icon: Award,
            href: product.category === "watches" ? "/warranty/jewelry#chasovnici" : product.category === "jewellery" ? "/warranty/jewelry" : undefined,
          },
          { label: "30 дни замяна",              Icon: RefreshCw, href: undefined },
          { label: "Доставка за 1–2 работни дни с Еконт", Icon: Truck,  href: undefined },
          { label: "Преглед и тест",              Icon: Eye,       href: undefined },
        ].map(({ label, Icon, href }, i) => {
          const inner = (
            <>
              <Icon className="w-4 h-4 text-ink-muted flex-shrink-0" strokeWidth={1.5} />
              <p className={`font-sans text-[11px] font-light tracking-wide leading-snug ${
                href ? "text-navy border-b border-transparent hover:border-navy/30 transition-colors duration-200" : "text-ink-soft"
              }`}>
                {label}
              </p>
            </>
          );
          const cls = `py-4 px-5 flex items-center gap-3 ${i < 2 ? "border-b border-border" : ""} ${i % 2 === 0 ? "border-r border-border" : ""}`;
          return href ? (
            <Link key={label} href={href} className={`${cls} group hover:bg-ivory-warm transition-colors duration-200`}>
              {inner}
            </Link>
          ) : (
            <div key={label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-sans text-[11px] tracking-widest uppercase px-4 py-3 min-h-[44px] max-[373px]:px-2.5 max-[373px]:tracking-wider max-[349px]:px-2 max-[349px]:text-[10px] transition-all duration-200 ${
                activeTab === tab
                  ? "text-charcoal border-b-2 border-navy -mb-px"
                  : "text-ink-muted hover:text-ink-soft"
              }`}
            >
              {tab === "description" ? "Описание" : tab === "specs" ? "Спецификации" : "Доставка"}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {activeTab === "description" && (
            <div className="flex flex-col gap-4">
              {product.descriptionSections ? (
                product.descriptionSections.map((section, i) => {
                  const paragraphs = Array.isArray(section.body) ? section.body : [section.body];
                  return (
                    <div key={i}>
                      <p className="font-sans text-sm font-medium text-charcoal tracking-wide mb-0.5">
                        {section.heading}
                      </p>
                      {paragraphs.map((para, j) => (
                        <p
                          key={j}
                          className={`font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide ${j > 0 ? "mt-2" : ""}`}
                        >
                          <BoldedText text={para} />
                        </p>
                      ))}
                    </div>
                  );
                })
              ) : product.tabDescription ? (
                product.tabDescription.map((para, i) => (
                  <p key={i} className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
                    {para}
                  </p>
                ))
              ) : (
                <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
                  {product.description}
                </p>
              )}
            </div>
          )}
          {activeTab === "specs" && (
            <div className="flex flex-col gap-3">
              {/* An empty value (e.g. clutch dimensions not measured yet) hides the whole
                  row - customers never see a placeholder like "TBD". */}
              {product.specs.filter(({ value }) => value.trim() !== "").map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-border">
                  <span className="font-sans text-[11px] text-ink-muted tracking-wide uppercase">{label}</span>
                  <span className="font-sans text-sm font-light text-charcoal text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === "delivery" && (
            <div className="flex flex-col gap-4 text-sm font-light text-ink-soft leading-relaxed tracking-wide">
              <p><strong className="text-charcoal font-normal">Безплатна доставка</strong> за поръчки над €60</p>
              <p>Доставяме с <strong className="text-charcoal font-normal">Еконт</strong> в цяла България</p>
              <p>Обработваме до 14:00 ч. - изпращаме същия ден. <strong className="text-charcoal font-normal">Доставка за 1–2 работни дни с Еконт</strong>.</p>
              {CARD_PAYMENTS_ENABLED && <p><strong className="text-charcoal font-normal">Плащане с карта</strong> - −5% отстъпка от стоката (до €25).</p>}
              <p><strong className="text-charcoal font-normal">Преглед и тест преди плащане</strong>{CARD_PAYMENTS_ENABLED ? " при наложен платеж" : ""} - право да откажете на място.</p>
              <p><strong className="text-charcoal font-normal">30 дни лесна замяна</strong> - пишете на info@lorenzo-ricci.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Official Viber logo (Simple Icons), tinted in the Viber brand purple.
function ViberIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#7360F2" aria-hidden="true">
      <path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.696 6.7.633 9.817.57 12.933.488 18.776 6.12 20.36h.003l-.004 2.416s-.037.977.61 1.177c.777.242 1.234-.5 1.98-1.302.407-.44.972-1.084 1.397-1.58 3.85.326 6.812-.416 7.15-.525.776-.252 5.176-.816 5.892-6.657.74-6.02-.36-9.83-2.34-11.546-.596-.55-3.006-2.3-8.375-2.323 0 0-.395-.025-1.037-.017zm.058 1.693c.545-.004.88.017.88.017 4.542.02 6.717 1.388 7.222 1.846 1.675 1.435 2.53 4.868 1.906 9.897v.002c-.604 4.878-4.174 5.184-4.832 5.395-.28.09-2.882.737-6.153.524 0 0-2.436 2.94-3.197 3.704-.12.12-.26.167-.352.144-.13-.033-.166-.188-.165-.414l.02-4.018c-4.762-1.32-4.485-6.292-4.43-8.895.054-2.604.543-4.738 1.996-6.173 1.96-1.773 5.474-2.018 7.11-2.03zm.38 2.602c-.167 0-.303.135-.304.302 0 .167.133.303.3.305 1.624.01 2.946.537 4.028 1.592 1.073 1.046 1.62 2.468 1.633 4.334.002.167.14.3.307.3.166-.002.3-.138.3-.304-.014-1.984-.618-3.596-1.816-4.764-1.19-1.16-2.692-1.753-4.447-1.765zm-3.96.695c-.19-.032-.4.005-.616.117l-.01.002c-.43.247-.816.562-1.146.932-.002.004-.006.004-.008.008-.267.323-.42.638-.46.948-.008.046-.01.093-.007.14 0 .136.022.27.065.4l.013.01c.135.48.473 1.276 1.205 2.604.42.768.903 1.5 1.446 2.186.27.344.56.673.87.984l.132.132c.31.308.64.6.984.87.686.543 1.418 1.027 2.186 1.447 1.328.733 2.126 1.07 2.604 1.206l.01.014c.13.042.265.064.402.063.046.002.092 0 .138-.008.31-.036.627-.19.948-.46.004 0 .003-.002.008-.005.37-.33.683-.72.93-1.148l.003-.01c.225-.432.15-.842-.18-1.12-.004 0-.698-.58-1.037-.83-.36-.255-.73-.492-1.113-.71-.51-.285-1.032-.106-1.248.174l-.447.564c-.23.283-.657.246-.657.246-3.12-.796-3.955-3.955-3.955-3.955s-.037-.426.248-.656l.563-.448c.277-.215.456-.737.17-1.248-.217-.383-.454-.756-.71-1.115-.25-.34-.826-1.033-.83-1.035-.137-.165-.31-.265-.502-.297zm4.49.88c-.158.002-.29.124-.3.282-.01.167.115.312.282.324 1.16.085 2.017.466 2.645 1.15.63.688.93 1.524.906 2.57-.002.168.13.306.3.31.166.003.305-.13.31-.297.025-1.175-.334-2.193-1.067-2.994-.74-.81-1.777-1.253-3.05-1.346h-.024zm.463 1.63c-.16.002-.29.127-.3.287-.008.167.12.31.288.32.523.028.875.175 1.113.422.24.245.388.62.416 1.164.01.167.15.295.318.287.167-.008.295-.15.287-.317-.03-.644-.215-1.178-.58-1.557-.367-.378-.893-.574-1.52-.607h-.018z" />
    </svg>
  );
}
