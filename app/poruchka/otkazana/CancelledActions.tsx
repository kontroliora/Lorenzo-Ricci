"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { loadCardCartSnapshot } from "@/lib/card-cart-snapshot";
import { releasePendingOrder } from "@/lib/release-pending-order";

// Brings the cart back after the round trip to Stripe (the cart store is in memory only; the checkout left a snapshot
// in sessionStorage) and offers the way back into the checkout. Nothing is cleared here.
export function CancelledActions() {
  const params = useSearchParams();
  const ref    = params.get("ref");
  const ct     = params.get("ct");
  const hasCart = useCartStore((s) => s.items.length > 0);

  // The customer is back without paying: free the reserved stock now (a retry must not be blocked by this hold).
  useEffect(() => { releasePendingOrder(ref, ct); }, [ref, ct]);

  useEffect(() => {
    if (useCartStore.getState().items.length > 0) return;
    const snap = loadCardCartSnapshot(ref);
    if (snap) useCartStore.setState({ items: snap.items, recoveryPrefill: snap.prefill });
  }, [ref]);

  // Opens the drawer straight at the checkout step, contact details already filled in. Cash on delivery is the
  // form's default, so "try again" and "cash on delivery" both land in the same place.
  const reopenCheckout = () => useCartStore.setState({ isOpen: true, pendingCheckout: true });

  return (
    <>
      <p className="font-sans text-sm text-ink-soft leading-relaxed mt-4">
        {hasCart
          ? "Количката ви е запазена - можете да опитате отново, когато пожелаете."
          : "Ако желаете да опитате отново, добавете избраните продукти в количката."}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {hasCart ? (
          <>
            <button type="button" onClick={reopenCheckout} className="btn-primary w-full">Опитай отново</button>
            <button type="button" onClick={reopenCheckout} className="btn-outline w-full">Наложен платеж е винаги възможен</button>
          </>
        ) : (
          <>
            <Link href="/" className="btn-primary w-full">Опитай отново</Link>
            <Link href="/" className="btn-outline w-full">Наложен платеж е винаги възможен</Link>
          </>
        )}
      </div>
    </>
  );
}
