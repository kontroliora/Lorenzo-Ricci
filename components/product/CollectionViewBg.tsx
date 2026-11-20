"use client";
import { useCallback } from "react";
import type { Product } from "@/lib/types";
import { getProductBySlug } from "@/lib/products";
import { opoFixesPrice } from "@/lib/one-plus-one";
import { CollectionProductView, useSetSecondPiece } from "@/components/product/CollectionProductView";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";

// The Bulgarian shop's adapter of CollectionProductView: a piece is the catalogue piece + the durable price override the server read
// (the same merge as app/products/[slug]/page.tsx; not for a 1+1 group's fixed price).
type PriceOverride = { price: number; originalPrice: number };

export function CollectionViewBg({ pageSlug, priceOverrides, soldOut, reviewCounts, reviewAvgs }: {
  pageSlug: string;
  priceOverrides: Record<string, PriceOverride>; // the collection's pieces only (lib/price-overrides.ts)
  soldOut: string[];                             // the collection's pieces that cannot be bought (lib/sold-out.ts)
  reviewCounts: Record<string, number>;
  reviewAvgs?: Record<string, number>;
}) {
  const setSecond = useSetSecondPiece();
  const pieceOf = useCallback((s: string): Product | undefined => {
    const base = getProductBySlug(s);
    if (!base) return undefined;
    const ov = priceOverrides[s];
    return ov && !opoFixesPrice(s) ? { ...base, price: ov.price, originalPrice: ov.originalPrice } : base;
  }, [priceOverrides]);

  return (
    <CollectionProductView
      pageSlug={pageSlug}
      hrefPrefix="/products/"
      pieceOf={pieceOf}
      renderGallery={(p) => <ProductGallery images={p.images} productName={p.name} />}
      renderInfo={(p, switchTo) => <ProductInfo product={p} reviewCount={reviewCounts[p.slug] ?? 0} reviewAvg={reviewAvgs?.[p.slug]} soldOut={soldOut} pieceOf={pieceOf} onSwitch={switchTo} onPickChange={setSecond} />}
    />
  );
}
