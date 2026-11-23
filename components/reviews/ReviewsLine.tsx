import Link from "next/link";
import { fmtAvg, fmtCount, otzivLabel, type ReviewStats } from "@/lib/site-reviews-shared";

// Thin line right under the home hero (owner, 23.11.2026): "★ 4,8 · 2 947 отзива", a link to /otzivi. Numbers: lib/site-reviews.ts.
export function ReviewsLine({ stats }: { stats: ReviewStats | null }) {
  if (!stats) return null;
  return (
    <div data-testid="home-reviews-line" className="bg-ivory border-b border-border">
      <Link
        href="/otzivi"
        className="flex items-center justify-center gap-2 py-2.5 font-sans text-[12px] font-light tracking-wide text-ink-muted hover:text-navy transition-colors"
      >
        <span className="text-navy" aria-hidden>★</span>
        <span>
          <span className="font-medium text-charcoal">{fmtAvg(stats.avg)}</span> · {fmtCount(stats.count)} {otzivLabel(stats.count)}
        </span>
        <span aria-hidden className="text-ink-faint">›</span>
      </Link>
    </div>
  );
}
