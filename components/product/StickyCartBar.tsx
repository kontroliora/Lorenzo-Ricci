"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { useCartStore } from "@/lib/store";

interface Props {
  product: Product;
  effectiveInStock: boolean;
}

export function StickyCartBar({ product, effectiveInStock }: Props) {
  const [visible, setVisible] = useState(false);
  const [added, setAdded]     = useState(false);
  const { addItem } = useCartStore();

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

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

  const handleAdd = () => {
    if (!effectiveInStock) return;
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-xl text-navy leading-none">
                {product.currency}{product.price.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="font-sans text-xs text-ink-faint line-through hidden sm:inline">
                  {product.currency}{product.originalPrice!.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={effectiveInStock ? handleAdd : undefined}
            disabled={!effectiveInStock}
            className={`flex-shrink-0 ${
              effectiveInStock
                ? "btn-primary text-[10px] sm:text-[11px] px-5 sm:px-8 py-3"
                : "font-sans text-[10px] sm:text-[11px] tracking-[0.22em] uppercase px-5 sm:px-8 py-3 bg-ink-faint/20 text-ink-faint border border-border cursor-not-allowed"
            }`}
          >
            {!effectiveInStock ? (
              "ИЗЧЕРПАН"
            ) : added ? (
              "✓ ДОБАВЕНО"
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
