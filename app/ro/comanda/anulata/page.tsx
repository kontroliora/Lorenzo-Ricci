import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReleaseOnCancel } from "@/components/ro/cart/ReleaseOnCancel";

export const metadata: Metadata = {
  title: "Plata comenzii",
  robots: { index: false, follow: false },
};

// Stripe cancel return for the Romania shop (lib/payments.ts, contract item 3): the customer left the payment page.
// Nothing was charged and the cart (kept in the browser) is untouched.
export default function AnulataPage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <Suspense fallback={null}><ReleaseOnCancel /></Suspense>
      <div className="py-16 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Plata comenzii</p>
        <h1 className="font-serif text-display-md text-charcoal mb-4">Plata nu a fost finalizată</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-xl mx-auto px-5 sm:px-8 mt-10">
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide text-center">
          Coșul dumneavoastră a fost păstrat și nu s-a încasat nicio sumă.
        </p>

        <div className="flex justify-center mt-10">
          <Link href="/ro/ceasuri" className="btn-primary min-w-[220px]">Încercați din nou</Link>
        </div>

        <p className="font-sans text-xs text-ink-muted leading-relaxed tracking-wide text-center mt-8">
          Plata la livrare (ramburs) rămâne disponibilă oricând.
        </p>
      </div>
    </div>
  );
}
