"use client";
import { useEffect, useMemo, useState } from "react";
import { getProductBySlug } from "@/lib/products";
import { deriveGiftLines, isGiftClutch, pickGift, type GiftLine } from "@/lib/gifts";
import type { CartItem } from "@/lib/types";

// Live stock for the gift cardholders. /api/leather-stock is one small dynamic call (all slugs),
// shared by every component on the page and cached briefly, so the pages themselves stay static:
// they render the matching cardholder first and only adjust once these numbers arrive.
type StockMap = Record<string, number>;
const TTL_MS = 30_000;
let cached: { at: number; map: StockMap } | null = null;
let inflight: Promise<StockMap | null> | null = null;

function loadStock(): Promise<StockMap | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.map);
  if (!inflight) {
    inflight = fetch("/api/leather-stock")
      .then((r) => (r.ok ? r.json() : null))
      .then((map: StockMap | null) => {
        if (map && typeof map === "object") cached = { at: Date.now(), map };
        return map;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

function useLeatherStock(enabled: boolean): StockMap | null {
  const [map, setMap] = useState<StockMap | null>(cached?.map ?? null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadStock().then((m) => { if (!cancelled && m) setMap(m); });
    return () => { cancelled = true; };
  }, [enabled]);
  return map;
}

// The catalog's on/off switch: a cardholder switched off in lib/products.ts is never gifted.
const usable = (slug: string) => getProductBySlug(slug)?.inStock === true;

// The cardholder a clutch gets right now (matching one, else Bianco), or null. Non-clutches: null.
export function useGiftFor(clutchSlug: string, qty = 1): string | null {
  const isClutch = isGiftClutch(clutchSlug);
  const stock = useLeatherStock(isClutch);
  return useMemo(
    () => (isClutch ? pickGift(clutchSlug, qty, (s) => stock?.[s], usable) : null),
    [isClutch, clutchSlug, qty, stock],
  );
}

// Gift rows for the paid cart lines (display only - they are never cart items).
export function useGiftLines(items: CartItem[]): GiftLine[] {
  const hasClutch = items.some((i) => isGiftClutch(i.product.slug));
  const stock = useLeatherStock(hasClutch);
  return useMemo(
    () => deriveGiftLines(items.map((i) => ({ slug: i.product.slug, qty: i.quantity })), (s) => stock?.[s], usable),
    [items, stock],
  );
}
