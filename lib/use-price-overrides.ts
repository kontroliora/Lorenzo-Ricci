"use client";
import { useEffect, useState } from "react";
import type { Product } from "./types";

type PriceOverride = { price: number; originalPrice: number };
type OverrideMap = Record<string, PriceOverride>;

// Client-side counterpart to lib/price-overrides.ts's applyOverride, for the two
// "use client" components (BundleUpsell, CartCrossSell) that resolve products via
// getProductBySlug() outside any server-rendered page and so can't receive overrides
// as a prop. Fetches /api/price-overrides once per mount; starts empty (plain catalog
// prices) until it resolves, then re-renders with the discount applied.
export function usePriceOverrides(): (product: Product) => Product {
  const [overrides, setOverrides] = useState<OverrideMap>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/price-overrides")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: OverrideMap) => {
        if (!cancelled) setOverrides(data ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (product: Product) => {
    const ov = overrides[product.slug];
    return ov ? { ...product, price: ov.price, originalPrice: ov.originalPrice } : product;
  };
}
