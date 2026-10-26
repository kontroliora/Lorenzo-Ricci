import Link from "next/link";

// Homepage sale strip under the hero (owner, 26.10.2026). Server-rendered, static height, no animation / popup / countdown.
// The label (campaign phase by date) and the percentage (biggest live discount, rounded down to 5%) come from lib/sale-campaign.ts;
// app/page.tsx renders it only when both exist. Small text on purpose: the hero image stays the page's LCP.
export function SaleBanner({ label, pct }: { label: string; pct: number }) {
  return (
    <section aria-label="Намаления" data-testid="sale-banner" className="w-full bg-[#B3121F] text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center">
        <p className="font-sans text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase leading-snug">
          {label} · до −{pct}%
        </p>
        <Link
          href="/namalenia"
          className="inline-flex items-center justify-center min-h-[44px] px-6 border border-white/80 font-sans text-[10px] sm:text-[11px] tracking-[0.2em] uppercase hover:bg-white hover:text-[#B3121F] transition-colors duration-200"
        >
          Виж намаленията
        </Link>
      </div>
    </section>
  );
}
