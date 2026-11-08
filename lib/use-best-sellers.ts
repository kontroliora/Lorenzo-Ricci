"use client";
import { useEffect, useState } from "react";
import { COLLECTION_BEST_SELLER_FALLBACK } from "./new-collection";

// The women's collection's best sellers (app/api/collection-best-seller: last 14 days of orders, in stock, cached 1 h), fetched once
// per page load and shared by every caller. Until it answers (or if it fails): the fallback piece.
let pending: Promise<string[]> | null = null;
const load = (): Promise<string[]> =>
  (pending ??= fetch("/api/collection-best-seller")
    .then((r) => r.json() as Promise<{ slugs?: unknown }>)
    .then((d) => (Array.isArray(d.slugs) && d.slugs.every((s) => typeof s === "string") && d.slugs.length ? (d.slugs as string[]) : [COLLECTION_BEST_SELLER_FALLBACK]))
    .catch(() => { pending = null; return [COLLECTION_BEST_SELLER_FALLBACK]; }));

export function useCollectionBestSellers(enabled: boolean): string[] {
  const [slugs, setSlugs] = useState<string[]>([COLLECTION_BEST_SELLER_FALLBACK]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load().then((s) => { if (alive) setSlugs(s); });
    return () => { alive = false; };
  }, [enabled]);
  return slugs;
}
