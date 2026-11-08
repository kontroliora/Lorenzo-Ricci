"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, RefreshCw, Truck, Banknote, CreditCard, BadgeCheck, type LucideIcon } from "lucide-react";
import type { Product } from "@/lib/types";
import { getProductBySlug } from "@/lib/products";
import { PREPAYMENT_THRESHOLD_EUR } from "@/lib/price";
import { useRoCart } from "@/lib/ro/store";
import { RO_SLUGS } from "@/lib/ro/catalog";
import {
  ronOf,
  ronOriginalOf,
  roNeedsPrepayment,
  RO_CATEGORY_LABEL,
  EUR_RON,
  fmtRON,
  RO_CURRENCY,
  RO_DELIVERY_DAYS,
  RO_DELIVERY_TEXT,
  RO_FREE_SHIPPING_RON,
  roShipsFree,
  RO_SHIPPING_FEE_RON,
  RO_RETURN_DAYS,
  RO_COURIER_LABEL,
} from "@/lib/ro/config";
import { RoStickyCartBar } from "@/components/ro/product/RoStickyCartBar";
import { PayLine, CodLine } from "@/components/product/CodNote";
import { roCartLine } from "@/components/ro/product/cart-line";
import { roReviewsCount, roRatingText } from "@/components/ro/product/ro-text";
import { trackFbEvent, trackWithCapi, genEventId } from "@/lib/fbq";
import { PAGE_LOW_STOCK_MAX, savingsRon } from "@/lib/home-card-hints";
import { campaignLabelRo } from "@/lib/sale-campaign";
import { SavingsLine, DeliveryLine, OnePlusOneLine, OnePlusOneBadge, FreeShippingBadge, BoxLine, WarrantyLine } from "@/components/product/PriceExtras";
import { OnePlusOnePicker, type PickOption } from "@/components/product/OnePlusOnePicker";
import { ProductDetails } from "@/components/product/ProductDetails";
import { collectionSwatches, isCollectionSlug, collectionGroupOf, collectionMatchOf, collectionRank, COLLECTION_GROUP_LABEL, type ModelRow } from "@/lib/new-collection";
import { CollectionFreePicker, type FreeItem, type FreePickerText } from "@/components/product/CollectionFreePicker";
import { CollectionModelRow } from "@/components/product/CollectionModelRow";
import { CollectionTwoBoxes, TWO_BOX_RO, TWO_BOX_CARD_RO } from "@/components/product/CollectionTwoBoxes";
import { previewProductPhoto, warmProductPhoto } from "@/lib/warm-product";
import { opoGroupOf } from "@/lib/one-plus-one";
import { opoPriceLineRo } from "@/lib/ro/config";
import { opoPairPrice } from "@/lib/one-plus-one";
import { localizeProduct } from "@/lib/ro/catalog";
import { safeText } from "@/components/ro/home/ro-home-utils";
import { useLeatherStock } from "@/lib/use-gifts";

// A colour swatch reads as sold out when its product is switched off in
// lib/products.ts (inStock: false - the owner's single on/off switch); the
// hand-written inStock flags in the variant lists below are only a fallback.
const variantOff = (v: { slug: string; inStock: boolean }) => !(getProductBySlug(v.slug)?.inStock ?? v.inStock);

// Renders a description paragraph, turning **text** into <strong> spans and line breaks into
// <br>. Sections' `body` is plain owner-supplied copy (not full markdown) - this only exists so
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

// Colour switching must feel instant on phones: <Link prefetch> handles the route; this fetches the other
// colour's main photo at the exact size this device already loaded, so it paints from cache after the tap.
// Deduped per slug for the page's lifetime.
// The other product's main photo, downloaded and decoded ahead at the URL this screen's gallery uses (lib/warm-product.ts;
// the resized copy its srcset picks, lib/image-loader.ts). A tap / hover asks for it first.
function prefetchMainImage(slug: string) { warmProductPhoto(slug, "high"); }

// Grouped, not one flat list: a product's swatch row is whichever group its own slug belongs to.
// Only products sold in Romania (RO_SLUGS) are offered as swatches, so a swatch never links to a 404.
type Variant = { slug: string; label: string; color: string; inStock: boolean };

const WATCH_VARIANT_GROUPS: Variant[][] = [
  [
    { slug: "chrono-black",   label: "Negru",    color: "#111111", inStock: true },
    { slug: "golden-eclipse", label: "Auriu",    color: "#C9A84C", inStock: true },
    { slug: "polar-frost",    label: "Albastru", color: "#5B8DB8", inStock: true },
  ],
  [
    { slug: "yachting-black", label: "Negru",    color: "#111111", inStock: true },
    { slug: "yachting-blue",  label: "Albastru", color: "#1C3450", inStock: true },
    { slug: "yachting-white", label: "Alb",      color: "#FFFFFF", inStock: true },
  ],
];

const WALLET_VARIANTS: Variant[] = [
  { slug: "wallet-alabastro", label: "Alabastro - Alb",   color: "#E8E0D4", inStock: true  },
  { slug: "wallet-rubino",    label: "Rubino - Roșu",     color: "#8B1F1F", inStock: true  },
  { slug: "wallet-smeraldo",  label: "Smeraldo - Verde",  color: "#2A4A1E", inStock: false },
];

const CARDHOLDER_VARIANTS: Variant[] = [
  { slug: "cardholder-ambra",     label: "Ambra - Portocaliu",        color: "#C47A1A", inStock: true },
  { slug: "cardholder-bianco",    label: "Bianco - Alb",              color: "#E8E4DC", inStock: true },
  { slug: "cardholder-valentina", label: "Valentina - Roz",           color: "#C44B8A", inStock: true },
  { slug: "cardholder-zaffiro",   label: "Zaffiro - Albastru închis", color: "#1A2B4A", inStock: true },
  { slug: "cardholder-onice",     label: "Onice - Negru",             color: "#1B1818", inStock: true },
  { slug: "cardholder-giada",     label: "Giada - Verde închis",      color: "#1F362B", inStock: true },
  { slug: "cardholder-cremisi",   label: "Cremisi - Roșu",            color: "#BD0F1A", inStock: true },
  { slug: "cardholder-perla",     label: "Perla - Gri",               color: "#A99B8F", inStock: true },
  { slug: "cardholder-topazio",   label: "Topazio - Galben",          color: "#E4AB05", inStock: true },
  { slug: "cardholder-marina",    label: "Marina - Albastru",         color: "#1B5A80", inStock: true },
  { slug: "cardholder-panna",     label: "Panna - Alb-crem",          color: "#EFE7D6", inStock: true },
];

// Evening clutches (the one-off Milano Avorio bag is a single piece and has no siblings).
const CLUTCH_VARIANTS: Variant[] = [
  { slug: "clutch-torino",    label: "Torino - Negru",          color: "#1B1818", inStock: true },
  { slug: "clutch-verona",    label: "Verona - Bordo",          color: "#6B1F2B", inStock: true },
  { slug: "clutch-toscana",   label: "Toscana - Verde închis",  color: "#1F3A2E", inStock: true },
  { slug: "clutch-portofino", label: "Portofino - Crem",        color: "#EFE6D6", inStock: true },
  { slug: "clutch-capri",     label: "Capri - Albastru închis", color: "#1F2D4F", inStock: true },
];

// Show the low-stock line only when AVAILABLE units are at or below PAGE_LOW_STOCK_MAX (lib/home-card-hints.ts).

// The one-of-one bag: "limited", never "running out" (same as the Bulgarian page).
const ONE_OF_ONE_SLUG = "bag-milano-avorio";

// RO_CATEGORY_LABEL calls every bag a clutch; the big Milano Avorio bag is not one.
const categoryLabel = (p: Product): string =>
  p.slug === ONE_OF_ONE_SLUG ? "Genți" : RO_CATEGORY_LABEL[p.category];

// Where a watch / jewellery warranty is explained (counterpart of the Bulgarian /warranty/jewelry page).
const WARRANTY_HREF = "/ro/garantie-bijuterii";

// The women's collection's free-item picker (components/product/CollectionFreePicker.tsx), Romanian wording (formal).
const FREE_PICKER_RO: FreePickerText = {
  title: "Alegeți a doua bijuterie – gratuit:", setLabel: "Set", free: "Gratuit cu 1+1",
  groups: { clover: COLLECTION_GROUP_LABEL.clover.ro, nail: COLLECTION_GROUP_LABEL.nail.ro, snake: COLLECTION_GROUP_LABEL.snake.ro },
  chooseSecond: "Alegeți ca a doua bijuterie", details: "Vedeți toate detaliile", soldOut: "Stoc epuizat", second: "A doua bijuterie:", freeShort: "Gratuit",
  change: "Schimbați", close: "Închideți", again: "Încă unul la fel", remove: "Eliminați", zoom: "Vizualizare rapidă",
};
// Women's collection, no free piece picked yet: the main and the sticky button send the customer to box 2; a small link adds 1 only.
const CHOOSE_LABEL_RO = "↑ ALEGEȚI BIJUTERIA GRATUITĂ";
const ADD_ONE_RO = "sau adăugați doar 1";
// Cardholders (owner, 09.11.2026): the same two boxes as the women's collection.
const CHOOSE_LABEL_CARD_RO = "↑ ALEGEȚI PORT-CARDUL GRATUIT";
const FREE_PICKER_CARD_RO: FreePickerText = { ...FREE_PICKER_RO, title: "Alegeți al doilea – gratuit:", groups: {}, again: "Încă unul la fel", chooseSecond: "Alegeți ca al doilea" };

// Prepayment threshold in lei, for the wording of the delivery tab (the rule itself is roNeedsPrepayment).
const PREPAYMENT_THRESHOLD_RON = Math.round(PREPAYMENT_THRESHOLD_EUR * EUR_RON);

interface RoProductInfoProps {
  product: Product;     // already localized (localizeProduct), override-applied and made safe (roSafeProduct)
  reviewCount?: number; // number of reviews of the same product, as the Bulgarian store shows it (lib/reviews.ts)
  reviewAvg?: number;
  reviewsTranslated?: boolean; // every one of those reviews has a Romanian text: the numbers then need no "(Bulgaria)" label
  typeRow?: ModelRow | null;   // women's collection: "Tip" row (Colier / Brățară), above "Culoare"
  modelRow?: ModelRow | null;  // women's collection: "Piatră" / "Pietre" row (lib/new-collection.ts collectionModelRow)
}

export function RoProductInfo({ product, reviewCount = 0, reviewAvg = 0, reviewsTranslated = false, typeRow = null, modelRow = null }: RoProductInfoProps) {
  const addItem = useRoCart((s) => s.addItem);
  const cartItems = useRoCart((s) => s.items);
  const [added, setAdded] = useState(false);
  // 1+1 group: the free second item picked on the page (null = none; may be this same model)
  const [pick, setPick] = useState<string | null>(null);
  // Colour swatch tapped: shown as selected at once while the (prefetched) sibling page loads.
  const [pendingVariant, setPendingVariant] = useState<string | null>(null);
  useEffect(() => { setPendingVariant(null); }, [product.slug]);
  const shownVariant = pendingVariant ?? product.slug;
  const tapVariant = (e: React.MouseEvent, slug: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (slug !== product.slug) { setPendingVariant(slug); previewProductPhoto(slug); }
  };
  const opoStock = useLeatherStock(!!opoGroupOf(product.slug)); // the group's live stock (one batched call)
  // A product with no description content gets no Descriere tab and opens on the specs instead of an empty tab.
  const hasDescription = Boolean(
    product.descriptionSections?.length || product.tabDescription?.length ||
    product.description.trim(),
  );
  const tabs: readonly ("description" | "specs" | "delivery")[] = hasDescription
    ? ["description", "specs", "delivery"]
    : ["specs", "delivery"];
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "delivery">(hasDescription ? "description" : "specs");
  const [liveStock, setLiveStock] = useState<number | null>(null);
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  const ron = ronOf(product);
  // The sale is the Bulgarian one (owner, 2026-10-14): the current price, the old price crossed out (both converted to whole lei)
  // and the campaign badge by the price (no catalogue badge above the name).
  const originalRon = ronOriginalOf(product);
  const prepay = roNeedsPrepayment(product);

  const variants = (
    product.category === "watches"
      ? (WATCH_VARIANT_GROUPS.find((g) => g.some((v) => v.slug === product.slug)) ?? WATCH_VARIANT_GROUPS[0])
      : product.category === "wallets" ? WALLET_VARIANTS
      : product.category === "cardholders" ? CARDHOLDER_VARIANTS
      : product.category === "bags" && product.slug !== ONE_OF_ONE_SLUG ? CLUTCH_VARIANTS // the one-off bag has no siblings
      : product.category === "jewellery" ? collectionSwatches(product.slug, "ro") // 2026 collection: gold / silver (empty otherwise)
      : []
  ).filter((v) => RO_SLUGS.includes(v.slug));

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

  // Small colour groups (watches, wallets: 3): warm the other colours' main photo once the page has settled.
  // Big groups (cardholders: 11) only on touch/hover, so a phone doesn't download photos it may never look at.
  useEffect(() => {
    if (variants.length === 0 || variants.length > 4) return;
    const others = variants.filter((v) => v.slug !== product.slug);
    const id = window.setTimeout(() => others.forEach((v) => warmProductPhoto(v.slug)), 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  // Leather goods get one extra bullet (5 vs 4) - their copy needs room for both the hide/relief description
  // and the construction/format lines. Watches stay at 4.
  const isLeatherGoods =
    product.category === "wallets" ||
    product.category === "cardholders" ||
    product.category === "bags";
  const featuresLimit = isLeatherGoods ? 5 : 4;

  // Live free-to-sell count (/api/stock/<slug>, never cached - same number as the admin panel and the Bulgarian page). A product at 0
  // shows "Stoc epuizat" + a locked button; with no live number (request failed / slug missing) the static
  // catalog switch decides.
  useEffect(() => {
    let alive = true;
    fetch(`/api/stock/${product.slug}`)
      .then((r) => r.json())
      .then((d: { stock?: unknown }) => {
        if (alive) setLiveStock(typeof d?.stock === "number" ? d.stock : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [product.slug]);

  // inStock: false in lib/products.ts is the owner's hard off switch ("not for sale"), whatever the count says;
  // otherwise the live count decides (0 = sold out), and with no live number the product counts as available.
  const effectiveInStock = product.inStock && (liveStock === null || liveStock > 0);
  // What the stock hint shows: a switched-off product reads as 0 ("Stoc epuizat").
  const shownCount = product.inStock ? liveStock : 0;
  // Under the price: the saving in whole lei (not on a sold-out product) with the running campaign's badge.
  const saved = effectiveInStock ? savingsRon(product) : null;
  const campaign = campaignLabelRo();
  // Beside it: the free-delivery badge when the product alone reaches the threshold in lei (not on a sold-out product).
  const shipsFree = effectiveInStock && roShipsFree(product);

  // Cap the cart quantity at the LIVE stock (not the static products.ts value), so the +/- stepper and re-adds
  // can't exceed what we hold.
  const effectiveStock = liveStock ?? product.stock;

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_ids:      [product.sku],
      content_name:     product.name,
      content_type:     "product",
      content_category: "RO",
      value:            ronOf(product),
      currency:         RO_CURRENCY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  // The cart line carries the sale snapshot (originalRon, onSale: a sale item earns no set discount) and the prepayment flag
  // (EUR 1500 and up: not sold through the card checkout; the checkout then shows the prepayment flow instead of the delivery form).
  // ── 1+1 (lib/one-plus-one.ts), as on the Bulgarian page: the group's models sold in Romania, each available when its live stock,
  //    less what the cart already holds, covers it (this same model needs 2). Names and photos are the localized ones.
  const opo = effectiveInStock ? opoGroupOf(product.slug) : undefined;
  const inCart = (slug: string) => cartItems.find((i) => i.slug === slug)?.quantity ?? 0;
  const freeLeft = (slug: string): number => {
    const p = getProductBySlug(slug);
    if (!p || !p.inStock || !RO_SLUGS.includes(slug)) return 0;
    const live = slug === product.slug ? effectiveStock : (opoStock?.[slug] ?? p.stock);
    return (typeof live === "number" ? live : Infinity) - inCart(slug);
  };
  const pickOptions: PickOption[] = opo
    ? [...opo.slugs].filter((slug) => RO_SLUGS.includes(slug)).flatMap((slug) => {
        const raw = getProductBySlug(slug);
        if (!raw) return [];
        const p = slug === product.slug ? product : localizeProduct(raw);
        const name = safeText(opo.text.ro.shortName(p.name)) ?? opo.text.ro.shortName(raw.name);
        return [{ slug, name, image: { src: p.coverImage.src, alt: safeText(p.coverImage.alt) ?? name }, available: freeLeft(slug) >= (slug === product.slug ? 2 : 1) && freeLeft(product.slug) >= 1 }];
      })
    : [];
  // Women's collection (owner, 08.11.2026): NO default pick. Box 2 shows the picker open; the customer taps the free piece. Until
  // then the buttons read "↑ Изберете безплатното бижу" (they scroll to box 2) and "или добави само 1" adds the piece alone.
  const picked = opo && pick ? pickOptions.find((o) => o.slug === pick && o.available) ?? null : null;
  useEffect(() => { setPick(null); }, [product.slug]);
  const choosePick = (slug: string | null) => setPick(slug);
  const removePick = () => setPick(null);
  // Women's collection: the redesigned picker (set card, groups, quick view), localized names / texts / lei prices.
  // Cardholders' 1+1 (owner, 09.11.2026): the same boxes, one grid (no groups), in the group's own order.
  const cardOpo = opo?.id === "cardholders";
  const freeItems: FreeItem[] = opo && (isCollectionSlug(product.slug) || cardOpo)
    ? pickOptions.flatMap((o) => {
        const raw = getProductBySlug(o.slug);
        const group = cardOpo ? "all" as const : collectionGroupOf(o.slug);
        if (!raw || !group) return [];
        const p = o.slug === product.slug ? product : localizeProduct(raw);
        const name = safeText(p.name) ?? o.name;
        return [{ slug: o.slug, name, image: o.image,
          images: p.images.map((im) => ({ src: im.src, alt: safeText(im.alt) ?? name })), available: o.available, group,
          priceText: fmtRON(ronOf(p)), description: safeText(p.description) ?? safeText(p.shortDescription) ?? "", href: `/ro/produse/${o.slug}` }];
      }).sort((a, b) => (cardOpo ? 0 : collectionRank(a.slug) - collectionRank(b.slug)))
    : [];
  // The pair costs the dearer of the two in lei (the cheaper one is free): 341 lei for two cardholders, a piece's lei for jewellery.
  const pickedRaw = picked ? getProductBySlug(picked.slug) : undefined;
  const pickedRon = picked && picked.slug !== product.slug && pickedRaw ? ronOf(localizeProduct(pickedRaw)) : ron;
  const pairLabel = picked && opo ? opo.text.ro.addPair({ one: fmtRON(opoPairPrice(ron, pickedRon)) }) : null;

  const handleAdd = () => {
    addItem(roCartLine(product, effectiveStock));
    const raw = picked && picked.slug !== product.slug ? getProductBySlug(picked.slug) : undefined;
    const second = picked ? (picked.slug === product.slug ? product : raw ? localizeProduct(raw) : undefined) : undefined;
    if (second) addItem(roCartLine(second, second.slug === product.slug ? effectiveStock : (opoStock?.[second.slug] ?? second.stock)));
    setAdded(true);
    setPick(null);
    setTimeout(() => setAdded(false), 2000);
    trackWithCapi("AddToCart", {
      content_ids:      second ? [product.sku, second.sku] : [product.sku],
      content_name:     second ? `${product.name} + ${second.name}` : product.name,
      content_type:     "product",
      content_category: "RO",
      value:            second ? opoPairPrice(ron, pickedRon) : ron, // the cheaper one is free
      currency:         RO_CURRENCY,
      num_items:        second ? 2 : 1,
    }, genEventId("ATC"));
  };

  // Trust strip. Guarantee tile: the product's own (localized) warranty line when it has one (watches: commercial guarantee,
  // jewellery: lifetime guarantee, both explained on the warranty page); leather goods offer none, so that tile stays
  // craftsmanship. Payment tile: card (Romania has no cash on delivery), or advance payment for a prepayment product.
  const warrantyHref = product.category === "watches" ? `${WARRANTY_HREF}#ceasuri` : product.category === "jewellery" ? WARRANTY_HREF : undefined;
  const trust: { label: string; Icon: LucideIcon; href?: string }[] = [
    { label: product.warranty.trim() || "Manoperă artizanală", Icon: Award, href: warrantyHref },
    { label: `Retur în ${RO_RETURN_DAYS} zile`,                Icon: RefreshCw },
    { label: RO_DELIVERY_TEXT, Icon: Truck },
    prepay
      ? { label: "Plată în avans, stabilită direct cu noi", Icon: Banknote }
      : { label: "Plată securizată cu cardul", Icon: CreditCard },
    { label: "Produs original", Icon: BadgeCheck },
  ];
  const odd = trust.length % 2 === 1;
  const lastRowStart = odd ? trust.length - 1 : trust.length - 2;

  // The add-to-cart button and its payment line (placed under the picker for a women's-collection piece, else lower down).
  const inCollection = isCollectionSlug(product.slug);
  const twoBoxes = (inCollection || cardOpo) && !!opo; // women's collection / cardholders with their 1+1 running and in stock
  // Nothing picked yet (and something is pickable): the buttons point to box 2 instead of adding.
  const mustChoose = twoBoxes && !picked && freeItems.some((i) => i.available);
  const chooseLabel = mustChoose ? (cardOpo ? CHOOSE_LABEL_CARD_RO : CHOOSE_LABEL_RO) : null;
  const goToBox2 = () => document.querySelector("[data-testid=box-second]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const cta = (
    <>
    <button
      data-main-cta="true"
      onClick={!effectiveInStock ? undefined : chooseLabel && !added ? goToBox2 : handleAdd}
      disabled={!effectiveInStock}
      className={`w-full justify-center text-center ${chooseLabel && !added ? (chooseLabel.length > 30 ? "max-sm:px-2 max-sm:text-[11px] max-sm:tracking-[0.05em]" /* the cardholders' long label: one line at 375px */ : "max-sm:px-3 max-sm:tracking-[0.1em]") : ""} ${
        effectiveInStock
          ? "btn-primary"
          : "font-sans text-[11px] tracking-[0.22em] uppercase px-8 py-4 bg-ink-faint/20 text-ink-muted border border-border cursor-not-allowed"
      }`}
    >
      {!effectiveInStock
        ? "STOC EPUIZAT"
        : added
        ? "✓ ADĂUGAT ÎN COȘ"
        : chooseLabel ?? pairLabel ?? "ADAUGĂ ÎN COȘ"}
    </button>
    {chooseLabel && !added && (
      <button type="button" data-testid="add-one" onClick={handleAdd}
        className="block mx-auto -mt-1 py-2 px-3 font-sans text-xs text-ink-muted underline underline-offset-2 hover:text-charcoal">
        {ADD_ONE_RO}
      </button>
    )}
  
    {effectiveInStock && !prepay && <CodLine text="Plata cu cardul, online · Livrare cu Speedy" />}
    </>
  );

  // The colour row (also used inside box 1 of the women's collection's two boxes).
  const colourRow = variants.length > 1 ? (
        <div className="flex items-start gap-3">
          {/* label on the first swatch row (the cardholders' 11 colours wrap inside box 1) */}
          <span className="flex-shrink-0 font-sans text-[10px] leading-6 text-ink-muted tracking-widest uppercase">Culoare:</span>
          <div className="flex flex-wrap items-center gap-2">
            {variants.map((v) => (
              <Link
                key={v.slug}
                href={`/ro/produse/${v.slug}`}
                title={v.label}
                aria-label={v.label}
                prefetch={true}
                onClick={(e) => tapVariant(e, v.slug)}
                scroll={false} // a colour switch keeps the visitor where they are (no jump to the top)
                onTouchStart={() => prefetchMainImage(v.slug)}
                onMouseEnter={() => prefetchMainImage(v.slug)}
                className={`relative w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                  shownVariant === v.slug
                    ? "border-navy scale-110 shadow-[0_0_0_2px_rgba(15,40,80,0.15)]"
                    : "border-border hover:border-navy/40"
                } ${variantOff(v) ? "opacity-50" : ""}`}
                style={{ backgroundColor: v.color }}
              >
                {/* Diagonal strikethrough for out-of-stock */}
                {variantOff(v) && (
                  <span
                    className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                    aria-label="Stoc epuizat"
                  >
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                      <line x1="4" y1="4" x2="20" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <p className="font-sans text-[10px] text-ink-muted tracking-widest uppercase">
        {categoryLabel(product)} / {product.name}
      </p>

      {/* Name (no catalogue badge above it: the badges sit by the price) */}
      <div>
        <h1 className="font-serif text-display-md text-charcoal leading-tight">{product.name}</h1>
        <p className="font-sans text-[10px] text-ink-muted tracking-[0.2em] mt-1.5">
          Art. {product.sku}
        </p>
      </div>

      {/* Women's collection: "Вид" row (necklace / bracelet of the same model and metal) above the colour */}
      {!twoBoxes && typeRow && <CollectionModelRow row={typeRow} current={product.slug} hrefPrefix="/ro/produse/" onPrefetch={prefetchMainImage} />}

      {!twoBoxes && colourRow}

      {/* Women's collection: stone / stones row (other models, same type and metal) */}
      {!twoBoxes && modelRow && <CollectionModelRow row={modelRow} current={product.slug} hrefPrefix="/ro/produse/" onPrefetch={prefetchMainImage} />}

      {/* Rating: the product's reviews from the Bulgarian store (same numbers it shows). Labelled "(Bulgaria)" until every
          one of those reviews has a Romanian text. */}
      {reviewCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="star-rating text-sm">★★★★★</div>
          <a
            href="#reviews"
            className="font-sans text-xs text-ink-muted tracking-wide hover:text-navy transition-colors"
          >
            {roRatingText(reviewAvg)} · {roReviewsCount(reviewCount)}{reviewsTranslated ? "" : " ale clienților (Bulgaria)"}
          </a>
        </div>
      )}

      {/* Price (lei). Sale: the old price crossed out - the same sale as on the Bulgarian site, converted the same way. */}
      <div className="py-5 border-y border-border">
        <div className={`flex ${opo ? "flex-wrap items-center gap-x-3 gap-y-2" : "items-baseline gap-4"}`}>
          <span className={`font-serif text-4xl text-navy ${opo ? "mr-1" : ""}`}>
            {fmtRON(ron)}
          </span>
          {originalRon !== undefined && (
            <del className="font-sans text-lg text-ink-muted line-through">
              {fmtRON(originalRon)}
            </del>
          )}
          {/* 1+1 group: the red badge right after the price, then the green free-delivery one */}
          {opo && <OnePlusOneBadge text={opo.text.ro.badge} />}
          {opo && shipsFree && <FreeShippingBadge text="Livrare gratuită" size="page" />}
        </div>
        <SavingsLine text={saved !== null ? `Economisiți ${fmtRON(saved)}` : null} campaign={campaign} freeShipping={shipsFree && !opo ? "Livrare gratuită" : null} />
        {inCollection && <BoxLine text="Cutie luxoasă din catifea LORENZO RICCI" />}
        {inCollection && <WarrantyLine text="Garanție pe viață" href={WARRANTY_HREF} />}
        {/* 1+1 group (lib/one-plus-one.ts): "2 port-carduri pentru 341 lei ..." and the free second one, picked here */}
        {opo && !twoBoxes && <OnePlusOneLine badge={opo.text.ro.badge} line={opoPriceLineRo(product.slug)} size="page" />}
        {opo && !twoBoxes && (
          isCollectionSlug(product.slug)
            ? <CollectionFreePicker items={freeItems} currentName={product.name} selfSlug={product.slug} matchSlug={collectionMatchOf(product.slug)} selected={picked?.slug ?? null} onSelect={choosePick} onRemove={removePick} text={FREE_PICKER_RO} />
            : <OnePlusOnePicker title={opo.text.ro.pickTitle} options={pickOptions} selected={picked?.slug ?? null} onSelect={setPick} soldOutLabel="Stoc epuizat" />
        )}
      </div>

      {/* Women's collection: two numbered boxes (your piece + its selectors, the free second piece), the summary and the button
          (components/product/CollectionTwoBoxes.tsx). Sold out (no 1+1): the plain button. */}
      {twoBoxes ? (
        <CollectionTwoBoxes
          t={cardOpo ? TWO_BOX_CARD_RO : TWO_BOX_RO}
          current={{ name: product.name, image: product.coverImage, priceText: fmtRON(ron), type: product.slug.startsWith("necklace") ? "necklace" : "bracelet" }}
          selectors={(typeRow || colourRow || modelRow) ? (
            <div className="flex flex-col gap-4">
              {typeRow && <CollectionModelRow row={typeRow} current={product.slug} hrefPrefix="/ro/produse/" onPrefetch={prefetchMainImage} />}
              {colourRow}
              {modelRow && <CollectionModelRow row={modelRow} current={product.slug} hrefPrefix="/ro/produse/" onPrefetch={prefetchMainImage} />}
            </div>
          ) : null}
          items={freeItems}
          selfSlug={product.slug}
          matchSlug={cardOpo ? null : collectionMatchOf(product.slug)}
          pickerText={cardOpo ? FREE_PICKER_CARD_RO : FREE_PICKER_RO}
          picked={picked ? freeItems.find((i) => i.slug === picked.slug) ?? null : null}
          onSelect={choosePick}
          totalText={picked ? fmtRON(opoPairPrice(ron, pickedRon)) : fmtRON(ron)}
          struckText={picked ? fmtRON(ron + pickedRon) : null}
          cta={cta}
        />
      ) : inCollection && cta}

      {/* Delivery in one line, right under the price (no inspection before paying: the Romanian shop is card only) */}
      {effectiveInStock && (
        <DeliveryLine text={shipsFree ? RO_DELIVERY_TEXT : `Livrare gratuită peste ${fmtRON(RO_FREE_SHIPPING_RON)} · ${RO_DELIVERY_TEXT}`} />
      )}

      {/* Card payment, said under the price (not for a prepayment product) */}
      {effectiveInStock && !prepay && (
        <PayLine text="Plată securizată cu cardul" marks />
      )}

      {/* Stock indicator - the number AVAILABLE (free to order). Shown only below the low-stock threshold; above
          it nothing is revealed (we don't disclose how much we hold). Premium and restrained - a quiet nudge,
          never a loud "HURRY". */}
      {shownCount !== null && shownCount <= PAGE_LOW_STOCK_MAX && (
        <div className="flex items-center gap-2">
          {shownCount === 0 ? (
            <>
              <span className="text-ink-muted text-xs">◈</span>
              <span className="font-sans text-[11px] text-ink-muted tracking-wide">Stoc epuizat</span>
            </>
          ) : product.slug === ONE_OF_ONE_SLUG ? (
            // A one-of-one is limited, not "running out".
            <>
              <span className="text-navy/70 text-xs">◈</span>
              <span className="font-sans text-[11px] text-navy tracking-wide font-medium">Limitat la un singur exemplar</span>
            </>
          ) : (
            <>
              <span className="text-amber-600/80 text-xs">◈</span>
              <span className="font-sans text-[11px] text-amber-700 tracking-wide font-medium">
                {shownCount === 1 ? "Ultima bucată rămasă" : `Au mai rămas doar ${shownCount} bucăți`}
              </span>
            </>
          )}
        </div>
      )}

      {viewerCount !== null && shownCount !== null && shownCount > 0 && shownCount <= PAGE_LOW_STOCK_MAX && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B5451B] animate-pulse flex-shrink-0" />
          <span className="font-sans text-[11px] text-[#B5451B] tracking-wide">
            {viewerCount} persoane vizualizează acest produs acum
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

      {/* 2026 collection: "Detalii" rows that have a value + the box line (nothing for other products) */}
      <ProductDetails title="Detalii" rows={product.details} note={product.deliveryNote} />

      {/* Natural-variation note: above the CTA on desktop so it's read before ordering;
          on phones it sits right under the button instead. Same text, one of the two renders. */}
      {product.materialNote && (
        <p className="hidden sm:block font-sans text-xs font-light text-ink-soft leading-relaxed tracking-wide border-l-2 border-navy/20 pl-3">
          {product.materialNote}
        </p>
      )}

      {/* CTA (a women's-collection piece has it right after the picker, further up) */}
      {!twoBoxes && !inCollection && cta}

      {/* Phones: the natural-variation note goes under the button (see above). */}
      {product.materialNote && (
        <p className="sm:hidden font-sans text-[11px] font-light text-ink-muted leading-relaxed tracking-wide">
          {product.materialNote}
        </p>
      )}

      <RoStickyCartBar product={product} effectiveInStock={effectiveInStock} onAdd={handleAdd} pairLabel={pairLabel} chooseLabel={chooseLabel} onChoose={goToBox2} />

      {/* Trust strip */}
      <div className="grid grid-cols-2 gap-0 border border-border">
        {trust.map(({ label, Icon, href }, i) => {
          const isLoneLast = odd && i === trust.length - 1;
          const cls = `py-4 px-5 flex items-center gap-3 ${i < lastRowStart ? "border-b border-border" : ""} ${
            i % 2 === 0 && !isLoneLast ? "border-r border-border" : ""
          } ${isLoneLast ? "col-span-2" : ""}`;
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
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-sans text-[11px] tracking-widest uppercase px-4 py-3 max-[373px]:px-2.5 max-[373px]:tracking-wider max-[349px]:px-2 max-[349px]:text-[10px] transition-all duration-200 ${
                activeTab === tab
                  ? "text-charcoal border-b-2 border-navy -mb-px"
                  : "text-ink-muted hover:text-ink-soft"
              }`}
            >
              {tab === "description" ? "Descriere" : tab === "specs" ? "Specificații" : "Livrare"}
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
              {/* An empty value (e.g. dimensions not measured yet) hides the whole row - customers never see
                  a placeholder. */}
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
              <p>
                <strong className="text-charcoal font-normal">Livrare gratuită</strong> pentru comenzile de la {fmtRON(RO_FREE_SHIPPING_RON)}.
                Sub această sumă, transportul costă {fmtRON(RO_SHIPPING_FEE_RON)}.
              </p>
              <p>Livrăm în România prin <strong className="text-charcoal font-normal">{RO_COURIER_LABEL}</strong>.</p>
              <p>
                Coletul ajunge la dumneavoastră în <strong className="text-charcoal font-normal">{RO_DELIVERY_DAYS} zile lucrătoare</strong> de
                la expediere.
              </p>
              {prepay ? (
                <p>
                  <strong className="text-charcoal font-normal">Plată în avans</strong> - produsele cu un preț de la{" "}
                  {fmtRON(PREPAYMENT_THRESHOLD_RON)} în sus se comandă cu plată în avans și se stabilesc direct cu noi.
                </p>
              ) : (
                <p>
                  <strong className="text-charcoal font-normal">Plată cu cardul</strong>, online, securizată prin Stripe, în lei - nu aveți nimic de plătit la livrare.
                </p>
              )}
              <p>
                <strong className="text-charcoal font-normal">Drept de retragere {RO_RETURN_DAYS} zile</strong> - detalii în{" "}
                <Link href="/ro/politici/retur" className="text-navy border-b border-navy/30 hover:border-navy transition-colors duration-200">
                  politica de retur
                </Link>{" "}
                și în{" "}
                <Link href="/ro/politici/livrare" className="text-navy border-b border-navy/30 hover:border-navy transition-colors duration-200">
                  politica de livrare
                </Link>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
