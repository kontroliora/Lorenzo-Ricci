"use client";
import { useState } from "react";
import Link from "next/link";
import { Award, RefreshCw, Truck, Eye } from "lucide-react";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { reviewSummary } from "@/lib/reviews";

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

interface ProductInfoProps {
  product: Product;
  reviewCount?: number;
}

export function ProductInfo({ product, reviewCount = 0 }: ProductInfoProps) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "delivery">("description");

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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
        onClick={product.inStock ? handleAdd : undefined}
        disabled={!product.inStock}
        className={`w-full justify-center text-center ${
          product.inStock
            ? "btn-primary"
            : "font-sans text-[11px] tracking-[0.22em] uppercase px-8 py-4 bg-ink-faint/20 text-ink-faint border border-border cursor-not-allowed"
        }`}
      >
        {!product.inStock
          ? "ИЗЧЕРПАНА НАЛИЧНОСТ"
          : added
          ? "✓ ДОБАВЕНО В КОЛИЧКАТА"
          : "ДОБАВИ В КОЛИЧКАТА"}
      </button>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 bg-white/98 backdrop-blur-sm border-t border-border">
        <button
          onClick={product.inStock ? handleAdd : undefined}
          disabled={!product.inStock}
          className={`w-full justify-center ${
            product.inStock
              ? "btn-primary"
              : "font-sans text-[11px] tracking-[0.22em] uppercase px-8 py-4 bg-ink-faint/20 text-ink-faint border border-border cursor-not-allowed w-full"
          }`}
        >
          {!product.inStock ? "ИЗЧЕРПАНА" : added ? "✓ ДОБАВЕНО" : "ДОБАВИ В КОЛИЧКАТА"}
        </button>
      </div>

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
            <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide">
              {product.description}
            </p>
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
              <p><strong className="text-charcoal font-normal">Безплатна доставка</strong> за поръчки над €80</p>
              <p>Доставяме с <strong className="text-charcoal font-normal">Еконт и Спиди</strong> в цяла България</p>
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
