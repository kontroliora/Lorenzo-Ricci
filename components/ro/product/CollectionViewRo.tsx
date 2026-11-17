"use client";
import { useCallback } from "react";
import type { Product } from "@/lib/types";
import { getProductBySlug } from "@/lib/products";
import { opoFixesPrice } from "@/lib/one-plus-one";
import { localizeProduct } from "@/lib/ro/catalog";
import { CollectionProductView } from "@/components/product/CollectionProductView";
import { RoProductGallery } from "@/components/ro/product/RoProductGallery";
import { RoProductInfo } from "@/components/ro/product/RoProductInfo";
import { roSafeProduct } from "@/components/ro/product/ro-text";

// The Romanian shop's adapter of CollectionProductView (components/product/CollectionProductView.tsx - the same component as the
// Bulgarian page): a piece is the catalogue piece with the price override the server read, in Romanian and with every field that
// still has Bulgarian wording dropped - exactly what app/ro/produse/[slug]/page.tsx (roView) builds for the page's own piece.
type PriceOverride = { price: number; originalPrice: number };
type ReviewInfo = { count: number; avg: number; translated: boolean };

export function CollectionViewRo({ pageSlug, priceOverrides, soldOut, reviews }: {
  pageSlug: string;
  priceOverrides: Record<string, PriceOverride>; // the collection's pieces only (lib/price-overrides.ts)
  soldOut: string[];                             // the collection's pieces that cannot be bought (lib/sold-out.ts)
  reviews: Record<string, ReviewInfo>;
}) {
  const pieceOf = useCallback((s: string): Product | undefined => {
    const base = getProductBySlug(s);
    if (!base) return undefined;
    const ov = priceOverrides[s];
    const priced = ov && !opoFixesPrice(s) ? { ...base, price: ov.price, originalPrice: ov.originalPrice } : base;
    return roSafeProduct(localizeProduct(priced));
  }, [priceOverrides]);

  return (
    <CollectionProductView
      pageSlug={pageSlug}
      hrefPrefix="/ro/produse/"
      pieceOf={pieceOf}
      renderGallery={(p) => <RoProductGallery images={p.images} productName={p.name} />}
      renderInfo={(p, switchTo) => {
        const r = reviews[p.slug];
        return <RoProductInfo product={p} reviewCount={r?.count ?? 0} reviewAvg={r?.avg ?? 0} reviewsTranslated={r?.translated ?? false}
          soldOut={soldOut} pieceOf={pieceOf} onSwitch={switchTo} />;
      }}
    />
  );
}
