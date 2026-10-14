"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRoCart, type RoCartLine } from "@/lib/ro/store";
import { getProductBySlug } from "@/lib/products";
import { localizeProduct } from "@/lib/ro/catalog";
import { roCartLine } from "@/components/ro/product/cart-line";

// Landing page of the reminder e-mail (Romanian counterpart of /vazstanovi): reads the token from the link, pulls the saved cart,
// rebuilds it from the live catalogue (current prices, only products that still exist) and opens the cart drawer over the home page.
export function RoRecoverClient() {
  const router = useRouter();
  const params = useSearchParams();
  const restore = useRoCart((s) => s.restore);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = params.get("t")?.trim();
    if (!token) { setFailed(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cart-session/recover?t=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.items)) throw new Error("not recoverable");
        const lines: RoCartLine[] = [];
        for (const it of data.items as Array<{ slug?: string; quantity?: number }>) {
          const product = it?.slug ? getProductBySlug(String(it.slug)) : undefined;
          if (product) lines.push({ ...roCartLine(localizeProduct(product)), quantity: Math.max(1, Number(it.quantity) || 1) });
        }
        if (lines.length === 0) throw new Error("nothing left");
        if (cancelled) return;
        restore(lines);
        router.replace("/ro");
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [params, restore, router]);

  return (
    <main className="min-h-[70vh] bg-charcoal-deep flex flex-col items-center justify-center px-6 text-center">
      {!failed ? (
        <>
          <div className="w-9 h-9 border-2 border-white/15 border-t-white/70 rounded-full animate-spin mb-6" />
          <p className="font-serif text-xl text-white/90">Restabilim coșul dumneavoastră…</p>
          <p className="font-sans text-xs text-white/40 tracking-wide mt-2">Un moment, doar o secundă.</p>
        </>
      ) : (
        <>
          <p className="font-serif text-2xl text-white/90 mb-2">Coșul nu mai este disponibil</p>
          <p className="font-sans text-sm text-white/45 leading-relaxed max-w-xs mb-8">
            Linkul a expirat sau comanda a fost deja plasată. Vă invităm să vizitați din nou magazinul.
          </p>
          <Link href="/ro" className="btn-outline-light">Către magazin</Link>
        </>
      )}
    </main>
  );
}
