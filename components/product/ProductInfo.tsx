"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, RefreshCw, Truck, Eye } from "lucide-react";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { reviewSummary } from "@/lib/reviews";
import { SummerCountdown } from "@/components/product/SummerCountdown";
import { StickyCartBar } from "@/components/product/StickyCartBar";
import { trackFbEvent, trackWithCapi, genEventId } from "@/lib/fbq";

const WATCH_VARIANTS = [
  { slug: "chrono-black",   label: "Black", color: "#111111",  inStock: true },
  { slug: "golden-eclipse", label: "Gold",  color: "#C9A84C",  inStock: true },
  { slug: "polar-frost",    label: "Blue",  color: "#5B8DB8",  inStock: true },
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
];

// Viber quick-order deep link — opens a 1:1 chat with the store number.
// Format verified against the de-facto standard: viber://chat?number=<E.164>,
// tappable on iOS/Android. %2B is the encoded leading "+".
const VIBER_LINK = "viber://chat?number=%2B359888081811";

// Product-page Viber quick-order button. Hidden for now — flip to `true` to
// bring it back (nothing is deleted).
const SHOW_VIBER = false;

// Show the low-stock badge only when AVAILABLE units drop below this. Easily
// bumped (e.g. to 10 for the pricier watches).
const LOW_STOCK_THRESHOLD = 6;

interface ProductInfoProps {
  product: Product;
  reviewCount?: number;
}

export function ProductInfo({ product, reviewCount = 0 }: ProductInfoProps) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "delivery">("description");
  const [walletStock, setWalletStock] = useState<number | null>(null);
  const [stockLoaded, setStockLoaded] = useState(false);

  // ALL sellable categories read the live available number (/api/stock =
  // KV − reserved for watches/jewellery, wallet_inventory for leather) — same as
  // the admin panel. So a product at 0 available shows "Изчерпан" + a locked
  // button automatically, for every category (no manual per-product flag).
  const hasInventory =
    product.category === "watches" ||
    product.category === "jewellery" ||
    product.category === "wallets" ||
    product.category === "cardholders";

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

  const effectiveInStock =
    hasInventory && stockLoaded && walletStock !== null
      ? walletStock > 0
      : product.inStock;

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
      currency:     product.currency,
    });
  }, [product.slug]);

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  const handleAdd = () => {
    addItem({ ...product, stock: effectiveStock });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    trackWithCapi("AddToCart", {
      content_ids:  [product.sku],
      content_name: product.name,
      content_type: "product",
      value:        product.price,
      currency:     product.currency,
      num_items:    1,
    }, genEventId("ATC"));
  };

  const handleViberClick = () => {
    trackFbEvent("Contact", {
      content_ids:  [product.sku],
      content_name: product.name,
      content_type: "product",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <p className="font-sans text-[10px] text-ink-faint tracking-widest uppercase">
        {product.category === "watches" ? "Часовници"
          : product.category === "wallets" ? "Портфейли"
          : product.category === "cardholders" ? "Кардхолдъри"
          : "Бижута"} / {product.name}
      </p>

      {/* Name & badge */}
      <div>
        {product.badge && (
          <span className="inline-block bg-navy/10 text-navy border border-navy/30 font-sans text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 mb-3">
            {product.badge}
          </span>
        )}
        <h1 className="font-serif text-display-md text-charcoal leading-tight">{product.name}</h1>
        <p className="font-sans text-[10px] text-ink-faint tracking-[0.2em] mt-1.5">
          Арт. {product.sku}
        </p>
      </div>

      {/* Color variant selector - watches, wallets, cardholders */}
      {(product.category === "watches" || product.category === "wallets" || product.category === "cardholders") && (() => {
        const variants =
          product.category === "watches" ? WATCH_VARIANTS :
          product.category === "wallets" ? WALLET_VARIANTS :
          CARDHOLDER_VARIANTS;
        return (
          <div className="flex items-center gap-3">
            <span className="font-sans text-[10px] text-ink-faint tracking-widest uppercase">Цвят:</span>
            <div className="flex items-center gap-2">
              {variants.map((v) => (
                <Link
                  key={v.slug}
                  href={`/products/${v.slug}`}
                  title={v.label}
                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                    product.slug === v.slug
                      ? "border-navy scale-110 shadow-[0_0_0_2px_rgba(15,40,80,0.15)]"
                      : "border-border hover:border-navy/40"
                  } ${!v.inStock ? "opacity-50" : ""}`}
                  style={{ backgroundColor: v.color }}
                >
                  {/* Diagonal strikethrough for out-of-stock */}
                  {!v.inStock && (
                    <span
                      className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                      aria-label="Изчерпан"
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
        );
      })()}

      {/* Rating */}
      {reviewCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="star-rating text-sm">★★★★★</div>
          <a
            href="#reviews"
            className="font-sans text-xs text-ink-muted tracking-wide hover:text-navy transition-colors"
          >
            {(reviewSummary[product.slug]?.avg ?? 4.8).toFixed(1)} · {reviewCount} {reviewCount === 1 ? "ревю" : "ревюта"}
          </a>
        </div>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-4 py-5 border-y border-border">
        <span className="font-serif text-4xl text-navy">
          {product.currency}{product.price.toFixed(2)}
        </span>
        {hasDiscount && (
          <>
            <span className="font-sans text-lg text-ink-faint line-through">
              {product.currency}{product.originalPrice!.toFixed(2)}
            </span>
            <span className="font-sans text-xs text-navy bg-navy/8 px-2 py-0.5 border border-navy/20">
              -{discountPct}%
            </span>
          </>
        )}
      </div>

      {/* Summer promo banner - watches only, no timer */}
      {product.category === "watches" && <SummerCountdown />}

      {/* Stock indicator — the number AVAILABLE (free to order), matching the
          admin panel's "Налични". Shown only below the low-stock threshold; above
          it nothing is revealed (we don't disclose how much we hold). Premium and
          restrained — a quiet nudge, never a loud "HURRY". */}
      {hasInventory && stockLoaded && walletStock !== null && walletStock < LOW_STOCK_THRESHOLD && (
        <div className="flex items-center gap-2">
          {walletStock === 0 ? (
            <>
              <span className="text-ink-faint text-xs">◈</span>
              <span className="font-sans text-[11px] text-ink-faint tracking-wide">Изчерпан</span>
            </>
          ) : (
            <>
              <span className="text-amber-600/80 text-xs">◈</span>
              <span className="font-sans text-[11px] text-amber-700/90 tracking-wide font-medium">
                {walletStock === 1 ? "Остава последен 1 брой" : `Остават ${walletStock} бройки`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Features */}
      <ul className="flex flex-col gap-2.5">
        {product.features.slice(0, 4).map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <span className="text-navy mt-0.5 flex-shrink-0 text-xs">◈</span>
            <span className="font-sans font-light text-ink-soft leading-relaxed tracking-wide">{f}</span>
          </li>
        ))}
      </ul>

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
          ? "ИЗЧЕРПАНА НАЛИЧНОСТ"
          : added
          ? "✓ ДОБАВЕНО В КОЛИЧКАТА"
          : "ДОБАВИ В КОЛИЧКАТА"}
      </button>

      {/* Viber quick order — hidden via SHOW_VIBER (flip the flag to bring it back) */}
      {SHOW_VIBER && (
      <div className="flex flex-col gap-3 -mt-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-faint/20" />
          <span className="font-sans text-[10px] text-ink-faint tracking-[0.18em] uppercase">или</span>
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
        <p className="text-center font-sans text-[11px] text-ink-faint tracking-wide">
          или ни добавете: <span className="text-ink-soft">+359 888 081 811</span>
        </p>
      </div>
      )}

      <StickyCartBar product={product} effectiveInStock={effectiveInStock} />

      {/* Trust strip */}
      <div className="grid grid-cols-2 gap-0 border border-border">
        {[
          {
            label: product.category === "watches"
              ? "2 години гаранция"
              : product.category === "jewellery"
              ? "Доживотна гаранция"
              : "Майсторска изработка",
            Icon: Award,
            href: product.category === "jewellery" ? "/warranty/jewelry" : undefined,
          },
          { label: "30 дни замяна",              Icon: RefreshCw, href: undefined },
          { label: "Доставка до 2 работни дни",  Icon: Truck,     href: undefined },
          { label: "Преглед и тест",              Icon: Eye,       href: undefined },
        ].map(({ label, Icon, href }, i) => {
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
        <div className="flex border-b border-border">
          {(["description", "specs", "delivery"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-sans text-[11px] tracking-widest uppercase px-4 py-3 transition-all duration-200 ${
                activeTab === tab
                  ? "text-charcoal border-b-2 border-navy -mb-px"
                  : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {tab === "description" ? "Описание" : tab === "specs" ? "Спецификации" : "Доставка"}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {activeTab === "description" && (
            <div className="flex flex-col gap-4">
              {product.tabDescription ? (
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
              {product.materialNote && (
                <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
                  {product.materialNote}
                </p>
              )}
            </div>
          )}
          {activeTab === "specs" && (
            <div className="flex flex-col gap-3">
              {product.specs.map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-border">
                  <span className="font-sans text-[11px] text-ink-faint tracking-wide uppercase">{label}</span>
                  <span className="font-sans text-sm font-light text-charcoal text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === "delivery" && (
            <div className="flex flex-col gap-4 text-sm font-light text-ink-soft leading-relaxed tracking-wide">
              <p><strong className="text-charcoal font-normal">Безплатна доставка</strong> за поръчки над €60</p>
              <p>Доставяме с <strong className="text-charcoal font-normal">Еконт</strong> в цяла България</p>
              <p>Обработваме до 14:00 ч. - изпращаме същия ден. Доставка до <strong className="text-charcoal font-normal">2 работни дни</strong>.</p>
              <p><strong className="text-charcoal font-normal">Преглед и тест преди плащане</strong> - право да откажете на място.</p>
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
