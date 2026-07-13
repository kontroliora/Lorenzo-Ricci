"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { getProductBySlug } from "@/lib/products";
import type { CartItem } from "@/lib/types";

// Recovery landing: reads the token from the abandoned-cart email link, pulls
// the saved cart, rebuilds it from the live catalog, and drops the customer at
// the checkout step — nothing to re-add.
export function RecoverClient() {
  const router      = useRouter();
  const params      = useSearchParams();
  const restoreCart = useCartStore((s) => s.restoreCart);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = params.get("t")?.trim();
    if (!token) { setFailed(true); return; }

    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/cart-session/recover?t=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.items)) throw new Error("not recoverable");

        // Rebuild cart items from the live catalog (current price/stock), keeping
        // only products that still exist.
        const items: CartItem[] = [];
        for (const it of data.items as Array<{ slug?: string; quantity?: number }>) {
          const product = it?.slug ? getProductBySlug(String(it.slug)) : undefined;
          if (product) items.push({ product, quantity: Math.max(1, Number(it.quantity) || 1) });
        }
        if (items.length === 0) throw new Error("nothing in stock");
        if (cancelled) return;

        restoreCart(items, {
          name:  typeof data.name  === "string" ? data.name  : undefined,
          email: typeof data.email === "string" ? data.email : undefined,
          phone: typeof data.phone === "string" ? data.phone : undefined,
        });
        // Land on home; the cart drawer opens over it, already at checkout.
        router.replace("/");
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [params, restoreCart, router]);

  return (
    <main className="min-h-screen bg-charcoal-deep flex flex-col items-center justify-center px-6 text-center">
      {!failed ? (
        <>
          <div className="w-9 h-9 border-2 border-white/15 border-t-white/70 rounded-full animate-spin mb-6" />
          <p className="font-serif text-xl text-white/90">Възстановяваме количката ви…</p>
          <p className="font-sans text-xs text-white/40 tracking-wide mt-2">Момент, само секунда.</p>
        </>
      ) : (
        <>
          <p className="font-serif text-2xl text-white/90 mb-2">Количката не е налична</p>
          <p className="font-sans text-sm text-white/45 leading-relaxed max-w-xs mb-8">
            Връзката е изтекла или поръчката вече е направена. Разгледайте отново — с удоволствие ще ви помогнем.
          </p>
          <Link href="/" className="btn-outline">Към магазина</Link>
        </>
      )}
    </main>
  );
}
