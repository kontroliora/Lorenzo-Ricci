import { ShieldCheck, RefreshCw } from "lucide-react";

// Dark strip right under the hero (owner, 21.11.2026, modelled on a competitor's home page): lifetime warranty and
// 30-day exchange on a charcoal bar, no page scroll above the fold. The rating cell was removed 23.11.2026 (owner):
// the rating + count now show once, in the thin ReviewsLine right above this bar (source: lib/site-reviews.ts).
// No Trustpilot name or logo - the shop has no Trustpilot profile.

export function TrustBar() {
  return (
    <div data-testid="home-trust-bar" className="bg-charcoal-deep border-t border-white/10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 divide-y divide-white/10 sm:divide-y-0 sm:divide-x sm:divide-white/10">
        <div className="flex items-center justify-center gap-2.5 py-3.5 px-5">
          <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-white" strokeWidth={1.5} />
          <p className="font-sans text-[11px] font-light tracking-[0.14em] uppercase text-white">Доживотна гаранция</p>
        </div>
        <div className="flex items-center justify-center gap-2.5 py-3.5 px-5">
          <RefreshCw aria-hidden className="h-4 w-4 shrink-0 text-white" strokeWidth={1.5} />
          <p className="font-sans text-[11px] font-light tracking-[0.14em] uppercase text-white">30 дни лесна замяна</p>
        </div>
      </div>
    </div>
  );
}
