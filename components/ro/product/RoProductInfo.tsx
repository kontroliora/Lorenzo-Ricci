"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, RefreshCw, Truck, Eye, Banknote, type LucideIcon } from "lucide-react";
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
  RO_FREE_SHIPPING_RON,
  RO_SHIPPING_FEE_RON,
  RO_INSPECT_BEFORE_PAY,
  RO_RETURN_DAYS,
  RO_COURIER_LABEL,
} from "@/lib/ro/config";
import { RoStickyCartBar } from "@/components/ro/product/RoStickyCartBar";
import { CodBox, CodLine } from "@/components/product/CodNote";
import { roCartLine } from "@/components/ro/product/cart-line";
import { hasCyrillic, roReviewsCount, roRatingText } from "@/components/ro/product/ro-text";
import { trackFbEvent, trackWithCapi, genEventId } from "@/lib/fbq";

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
];

// Evening clutches (the one-off Milano Avorio bag is a single piece and has no siblings).
const CLUTCH_VARIANTS: Variant[] = [
  { slug: "clutch-torino",    label: "Torino - Negru",          color: "#1B1818", inStock: true },
  { slug: "clutch-verona",    label: "Verona - Bordo",          color: "#6B1F2B", inStock: true },
  { slug: "clutch-toscana",   label: "Toscana - Verde închis",  color: "#1F3A2E", inStock: true },
  { slug: "clutch-portofino", label: "Portofino - Crem",        color: "#EFE6D6", inStock: true },
  { slug: "clutch-capri",     label: "Capri - Albastru închis", color: "#1F2D4F", inStock: true },
];

// Show the low-stock line only when AVAILABLE units drop below this (bags sit at 5 as a matter of course).
const lowStockThreshold = (category: Product["category"]) => (category === "bags" ? 5 : 6);

// The one-of-one bag: "limited", never "running out" (same as the Bulgarian page).
const ONE_OF_ONE_SLUG = "bag-milano-avorio";

// RO_CATEGORY_LABEL calls every bag a clutch; the big Milano Avorio bag is not one.
const categoryLabel = (p: Product): string =>
  p.slug === ONE_OF_ONE_SLUG ? "Genți" : RO_CATEGORY_LABEL[p.category];

// Where a watch / jewellery warranty is explained (counterpart of the Bulgarian /warranty/jewelry page).
const WARRANTY_HREF = "/ro/garantie-bijuterii";

// Prepayment threshold in lei, for the wording of the delivery tab (the rule itself is roNeedsPrepayment).
const PREPAYMENT_THRESHOLD_RON = Math.round(PREPAYMENT_THRESHOLD_EUR * EUR_RON);

interface RoProductInfoProps {
  product: Product;     // already localized (localizeProduct), override-applied and made safe (roSafeProduct)
  reviewCount?: number; // number of reviews of the same product, as the Bulgarian store shows it (lib/reviews.ts)
  reviewAvg?: number;
  reviewsTranslated?: boolean; // every one of those reviews has a Romanian text: the numbers then need no "(Bulgaria)" label
}

export function RoProductInfo({ product, reviewCount = 0, reviewAvg = 0, reviewsTranslated = false }: RoProductInfoProps) {
  const addItem = useRoCart((s) => s.addItem);
  const [added, setAdded] = useState(false);
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

  const ron = ronOf(product);
  // The sale is the Bulgarian one (owner, 2026-10-14): the current price, the old price crossed out (both converted to whole lei)
  // and the catalogue badge. Defence in depth: a badge that still reads Bulgarian (overlay missing) is never printed.
  const originalRon = ronOriginalOf(product);
  const prepay = roNeedsPrepayment(product);
  const badge = product.badge && !hasCyrillic(product.badge) ? product.badge : undefined;

  const variants = (
    product.category === "watches"
      ? (WATCH_VARIANT_GROUPS.find((g) => g.some((v) => v.slug === product.slug)) ?? WATCH_VARIANT_GROUPS[0])
      : product.category === "wallets" ? WALLET_VARIANTS
      : product.category === "cardholders" ? CARDHOLDER_VARIANTS
      : product.category === "bags" && product.slug !== ONE_OF_ONE_SLUG ? CLUTCH_VARIANTS // the one-off bag has no siblings
      : []
  ).filter((v) => RO_SLUGS.includes(v.slug));

  // Small colour groups (watches, wallets: 3): warm the other colours' main photo once the page has settled.
  // Big groups (cardholders: 9) only on touch/hover, so a phone doesn't download photos it may never look at.
  useEffect(() => {
    if (variants.length === 0 || variants.length > 4) return;
    const others = variants.filter((v) => v.slug !== product.slug);
    const id = window.setTimeout(() => others.forEach((v) => prefetchMainImage(v.slug)), 1500);
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

  // Live free-to-sell count (public endpoint, slug -> number, same numbers as the admin panel). A product at 0
  // shows "Stoc epuizat" + a locked button; with no live number (request failed / slug missing) the static
  // catalog switch decides.
  useEffect(() => {
    let alive = true;
    fetch("/api/leather-stock")
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const n = d?.[product.slug];
        if (alive) setLiveStock(typeof n === "number" ? n : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [product.slug]);

  // inStock: false in lib/products.ts is the owner's hard off switch ("not for sale"), whatever the count says;
  // otherwise the live count decides (0 = sold out), and with no live number the product counts as available.
  const effectiveInStock = product.inStock && (liveStock === null || liveStock > 0);
  // What the stock hint shows: a switched-off product reads as 0 ("Stoc epuizat").
  const shownCount = product.inStock ? liveStock : 0;

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
  // (EUR 1500 and up: no cash on delivery; the checkout then shows the prepayment flow instead of the delivery form).
  const handleAdd = () => {
    addItem(roCartLine(product, effectiveStock));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    trackWithCapi("AddToCart", {
      content_ids:      [product.sku],
      content_name:     product.name,
      content_type:     "product",
      content_category: "RO",
      value:            ron,
      currency:         RO_CURRENCY,
      num_items:        1,
    }, genEventId("ATC"));
  };

  // Trust strip. Guarantee tile: the product's own (localized) warranty line when it has one (watches: commercial guarantee,
  // jewellery: lifetime guarantee, both explained on the warranty page); leather goods offer none, so that tile stays
  // craftsmanship. The payment tile never promises cash on delivery for a prepayment product. The parcel-inspection promise only
  // shows when the chosen courier allows it (RO_INSPECT_BEFORE_PAY).
  const warrantyHref = product.category === "watches" || product.category === "jewellery" ? WARRANTY_HREF : undefined;
  const trust: { label: string; Icon: LucideIcon; href?: string }[] = [
    { label: product.warranty.trim() || "Manoperă artizanală", Icon: Award, href: warrantyHref },
    { label: `Retur în ${RO_RETURN_DAYS} zile`,                Icon: RefreshCw },
    { label: `Livrare în ${RO_DELIVERY_DAYS} zile lucrătoare`, Icon: Truck },
    prepay
      ? { label: "Plată în avans, stabilită direct cu noi", Icon: Banknote }
      : { label: "Plată ramburs, la livrare",               Icon: Banknote },
    ...(RO_INSPECT_BEFORE_PAY ? [{ label: "Verificarea coletului înainte de plată", Icon: Eye }] : []),
  ];
  const odd = trust.length % 2 === 1;
  const lastRowStart = odd ? trust.length - 1 : trust.length - 2;

  return (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <p className="font-sans text-[10px] text-ink-faint tracking-widest uppercase">
        {categoryLabel(product)} / {product.name}
      </p>

      {/* Name & badge */}
      <div>
        {badge && (
          <span className="inline-block bg-navy/10 text-navy border border-navy/30 font-sans text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 mb-3">
            {badge}
          </span>
        )}
        <h1 className="font-serif text-display-md text-charcoal leading-tight">{product.name}</h1>
        <p className="font-sans text-[10px] text-ink-faint tracking-[0.2em] mt-1.5">
          Art. {product.sku}
        </p>
      </div>

      {/* Color variant selector - watches, wallets, cardholders, clutches */}
      {variants.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="font-sans text-[10px] text-ink-faint tracking-widest uppercase">Culoare:</span>
          <div className="flex items-center gap-2 max-[373px]:flex-wrap">
            {variants.map((v) => (
              <Link
                key={v.slug}
                href={`/ro/produse/${v.slug}`}
                title={v.label}
                aria-label={v.label}
                prefetch={true}
                onTouchStart={() => prefetchMainImage(v.slug)}
                onMouseEnter={() => prefetchMainImage(v.slug)}
                className={`relative w-6 h-6 rounded-full border-2 transition-all duration-200 ${
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
      )}

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
      <div className="flex items-baseline gap-4 py-5 border-y border-border">
        <span className="font-serif text-4xl text-navy">
          {fmtRON(ron)}
        </span>
        {originalRon !== undefined && (
          <del className="font-sans text-lg text-ink-faint line-through">
            {fmtRON(originalRon)}
          </del>
        )}
      </div>

      {/* Plata la livrare (ramburs), said under the price (not for a prepayment product) */}
      {effectiveInStock && !prepay && (
        <CodBox title="Plata la livrare (ramburs)" sub="Plătiți curierului la primirea coletului - fără plată în avans." />
      )}

      {/* Stock indicator - the number AVAILABLE (free to order). Shown only below the low-stock threshold; above
          it nothing is revealed (we don't disclose how much we hold). Premium and restrained - a quiet nudge,
          never a loud "HURRY". */}
      {shownCount !== null && shownCount < lowStockThreshold(product.category) && (
        <div className="flex items-center gap-2">
          {shownCount === 0 ? (
            <>
              <span className="text-ink-faint text-xs">◈</span>
              <span className="font-sans text-[11px] text-ink-faint tracking-wide">Stoc epuizat</span>
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
              <span className="font-sans text-[11px] text-amber-700/90 tracking-wide font-medium">
                {shownCount === 1 ? "Ultima bucată rămasă" : `Au mai rămas doar ${shownCount} bucăți`}
              </span>
            </>
          )}
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

      {/* Natural-variation note: above the CTA on desktop so it's read before ordering;
          on phones it sits right under the button instead. Same text, one of the two renders. */}
      {product.materialNote && (
        <p className="hidden sm:block font-sans text-xs font-light text-ink-soft leading-relaxed tracking-wide border-l-2 border-navy/20 pl-3">
          {product.materialNote}
        </p>
      )}

      {/* CTA */}
      <button
        data-main-cta="true"
        onClick={effectiveInStock ? handleAdd : undefined}
        disabled={!effectiveInStock}
        className={`w-full justify-center text-center ${
          effectiveInStock
            ? "btn-primary"
            : "font-sans text-[11px] tracking-[0.22em] uppercase px-8 py-4 bg-ink-faint/20 text-ink-faint border border-border cursor-not-allowed"
        }`}
      >
        {!effectiveInStock
          ? "STOC EPUIZAT"
          : added
          ? "✓ ADĂUGAT ÎN COȘ"
          : "ADAUGĂ ÎN COȘ"}
      </button>

      {effectiveInStock && !prepay && <CodLine text="Fără plată în avans · Livrare cu Econt · Plătiți la livrare" />}

      {/* Phones: the natural-variation note goes under the button (see above). */}
      {product.materialNote && (
        <p className="sm:hidden font-sans text-[11px] font-light text-ink-muted leading-relaxed tracking-wide">
          {product.materialNote}
        </p>
      )}

      <RoStickyCartBar product={product} effectiveInStock={effectiveInStock} onAdd={handleAdd} />

      {/* Trust strip */}
      <div className="grid grid-cols-2 gap-0 border border-border">
        {trust.map(({ label, Icon, href }, i) => {
          const isLoneLast = odd && i === trust.length - 1;
          const cls = `py-4 px-5 flex items-center gap-3 ${i < lastRowStart ? "border-b border-border" : ""} ${
            i % 2 === 0 && !isLoneLast ? "border-r border-border" : ""
          } ${isLoneLast ? "col-span-2" : ""}`;
          const inner = (
            <>
              <Icon className="w-4 h-4 text-ink-faint flex-shrink-0" strokeWidth={1.5} />
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
                  : "text-ink-faint hover:text-ink-soft"
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
                  <span className="font-sans text-[11px] text-ink-faint tracking-wide uppercase">{label}</span>
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
                  {fmtRON(PREPAYMENT_THRESHOLD_RON)} în sus se comandă cu plată în avans și se stabilesc direct cu noi. Pentru
                  acestea nu este disponibilă plata ramburs.
                </p>
              ) : (
                <p>
                  <strong className="text-charcoal font-normal">Plată ramburs</strong> - achitați comanda curierului, la primirea
                  coletului.
                </p>
              )}
              {RO_INSPECT_BEFORE_PAY && (
                <p>
                  <strong className="text-charcoal font-normal">Verificarea coletului înainte de plată</strong> - puteți deschide
                  coletul și refuza livrarea pe loc.
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
