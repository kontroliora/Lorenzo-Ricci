import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CancelledActions } from "./CancelledActions";

export const metadata: Metadata = {
  title: "Плащане",
  robots: { index: false, follow: false },
};

// The customer left the Stripe page (cancel_url). The static copy is rendered on the server; only the cart restore and
// the two buttons live in the client component (they need the cart store and the ?ref= parameter).
export default function Page() {
  return (
    <div className="min-h-screen pt-[116px] pb-24 px-5 sm:px-8">
      <div className="max-w-xl mx-auto mt-10 sm:mt-16 bg-ivory-card border border-border px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_2px_24px_rgba(15,12,8,0.06)]">
        <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-ivory-paper border border-border flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F2850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>

        <p className="section-tag mb-3">Плащане с карта</p>
        <h1 className="font-serif text-display-sm text-charcoal">Плащането не беше завършено</h1>
        <div className="gold-divider" />

        <p className="font-sans text-sm text-ink-soft leading-relaxed">
          Напуснахте страницата за плащане, преди да приключите. Не е удържана никаква сума от картата ви.
        </p>

        <Suspense
          fallback={
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/" className="btn-primary w-full">Опитай отново</Link>
              <Link href="/" className="btn-outline w-full">Наложен платеж е винаги възможен</Link>
            </div>
          }
        >
          <CancelledActions />
        </Suspense>
      </div>
    </div>
  );
}
