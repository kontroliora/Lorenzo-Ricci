"use client";
import { useEffect, type ReactNode } from "react";
import { CountryProvider } from "@/lib/country";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { useRoCart } from "@/lib/ro/store";
import { getProductBySlug } from "@/lib/products";
import { roEligible } from "@/lib/ro/config";
import { ronPrice } from "@/lib/ro/config";

// A cart line is a price snapshot taken when it was added. Re-derive each line's lei price from the catalog plus the
// current price overrides (the same inputs /api/order-ro validates against), so a price change never leaves a customer
// stuck on "prices were updated" with a cart that keeps the old numbers. Lines that can no longer be sold are dropped.
async function repriceCart(): Promise<void> {
  if (useRoCart.getState().items.length === 0) return;
  let overrides: Record<string, { price?: number }> = {};
  try {
    const r = await fetch("/api/price-overrides", { cache: "no-store" });
    if (r.ok) overrides = await r.json();
  } catch { /* offline: fall back to catalog prices */ }
  useRoCart.getState().reprice((line) => {
    const product = getProductBySlug(line.slug);
    if (!product || !roEligible(product)) return null;
    const eur = typeof overrides[line.slug]?.price === "number" ? overrides[line.slug].price! : product.price;
    return { ...line, ron: ronPrice(eur) };
  });
}

// Romanian market shell: country RO / locale ro for everything below, the cart restored from localStorage after
// mount (skipHydration, see lib/ro/store.ts), and <html lang> switched to "ro" while a Romanian page is on screen
// (the root layout is shared with the Bulgarian site and renders lang="bg").
export function RoProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void Promise.resolve(useRoCart.persist.rehydrate()).then(repriceCart);
    const html = document.documentElement;
    const previous = html.lang;
    html.lang = "ro";
    return () => { html.lang = previous || "bg"; };
  }, []);

  return (
    <CountryProvider country="RO">
      <LocaleProvider locale="ro">{children}</LocaleProvider>
    </CountryProvider>
  );
}
