"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";
import { trackWithCapi, genEventId } from "@/lib/fbq";
import { useCountry } from "@/lib/country";
import { displayPrice } from "@/lib/price";

interface Props {
  product: Product;
  effectiveInStock: boolean;
  /** The page's own add (it also adds a picked 1+1 second item); without it the bar adds the product alone. */
  onAdd?: () => void;
  /** "Добави 2 в количката – €65" while a 1+1 second item is picked. */
  pairLabel?: string | null;
  /** Women's collection, no free piece picked yet: "↑ ИЗБЕРЕТЕ …" - the tap calls onChoose (scroll to box 2), nothing is added. */
  chooseLabel?: string | null;
  onChoose?: () => void;
  /** Women's collection completing the cart's 1+1: what the total really goes up by, in place of the plain price. */
  priceNode?: React.ReactNode;
}

export function StickyCartBar({ product, effectiveInStock, onAdd, pairLabel = null, chooseLabel = null, onChoose, priceNode }: Props) {
  const [visible, setVisible] = useState(false);
  const [added, setAdded]     = useState(false);
  const { addItem } = useCartStore();

  const price = displayPrice(product, useCountry());

  useEffect(() => {
    const el = document.querySelector("[data-main-cta]");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Expose bar visibility so SalesNotification can position itself above us
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sticky-bar-h",
      visible ? "88px" : "0px"
    );
    // Room under the page for the bar, so it never covers the last footer line when scrolled to the end
    document.body.style.paddingBottom = visible ? "calc(88px + env(safe-area-inset-bottom, 0px))" : "";
  }, [visible]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--sticky-bar-h", "0px");
      document.body.style.paddingBottom = "";
    };
  }, []);

  const handleAdd = () => {
    if (!effectiveInStock) return;
    if (chooseLabel) { onChoose?.(); return; }
    if (onAdd) {
      onAdd();
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      return;
    }
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    trackWithCapi("AddToCart", {
      content_ids:  [product.sku],
      content_name: product.name,
      content_type: "product",
      value:        product.price,
      currency:     "EUR",
      num_items:    1,
    }, genEventId("ATC"));
  };

  return (
    <div
      aria-hidden={!visible}
      className={`fixed bottom-0 inset-x-0 z-40 will-change-transform transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="bg-white/98 backdrop-blur-md border-t border-border">
        <div
          className="max-w-7xl mx-auto px-5 sm:px-8 py-3 sm:py-3.5 flex items-center gap-4"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* Thumbnail */}
          <div className="relative w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 overflow-hidden bg-ivory-warm">
            <Image
              src={product.coverImage.src}
              alt={product.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>

          {/* Name + price */}
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[10px] tracking-widest uppercase text-ink-faint mb-0.5 truncate hidden sm:block">
              {product.name}
            </p>
            {priceNode ? <div data-testid="sticky-price" className="flex items-baseline gap-2.5">{priceNode}</div> : <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-xl text-navy leading-none">
                {price.text}
              </span>
              {price.original && (
                <span className="font-sans text-xs text-ink-faint line-through hidden sm:inline">
                  {price.original}
                </span>
              )}
            </div>}
          </div>

          {/* CTA */}
          <button
            onClick={effectiveInStock ? handleAdd : undefined}
            disabled={!effectiveInStock}
            data-testid="sticky-cta"
            className={`flex-shrink-0 min-h-[44px] ${
              effectiveInStock && chooseLabel && !added
                ? "btn-primary max-w-[190px] sm:max-w-none text-[10px] sm:text-[11px] leading-tight tracking-[0.12em] sm:tracking-[0.22em] px-3 sm:px-8 py-2.5 sm:py-3"
                : effectiveInStock
                ? "btn-primary text-[10px] sm:text-[11px] px-5 sm:px-8 py-3"
                : "font-sans text-[10px] sm:text-[11px] tracking-[0.22em] uppercase px-5 sm:px-8 py-3 bg-ink-faint/20 text-ink-faint border border-border cursor-not-allowed"
            }`}
          >
            {!effectiveInStock ? (
              "ИЗЧЕРПАН"
            ) : added ? (
              "✓ ДОБАВЕНО"
            ) : chooseLabel ? (
              chooseLabel
            ) : pairLabel ? (
              <>
                <span className="hidden sm:inline">{pairLabel}</span>
                <span className="sm:hidden">{pairLabel.replace(/ в количката/i, "")}</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">ДОБАВИ В КОЛИЧКАТА</span>
                <span className="sm:hidden">ПОРЪЧАЙ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
