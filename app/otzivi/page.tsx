import type { Metadata } from "next";
import Link from "next/link";
import { getSiteReviews, statsOf, filterReviews } from "@/lib/site-reviews";
import { fmtAvg, fmtCount, otzivLabel, REVIEWS_PAGE_SIZE, type ReviewFilter } from "@/lib/site-reviews-shared";
import { absUrl } from "@/lib/site";
import { ReviewsList } from "./ReviewsList";

// /otzivi - every customer review in one place (owner, 23.11.2026). Linked from the footer, the home hero line and reviews
// section; deliberately NOT in the main menu. Numbers: the one site-wide source, lib/site-reviews.ts.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const rs = await getSiteReviews();
  const s = rs && rs.length ? statsOf(rs) : null;
  const title = "Отзиви от клиенти";
  const description = s
    ? `${fmtAvg(s.avg)} от 5 от ${fmtCount(s.count)} ${otzivLabel(s.count)} на клиенти на Lorenzo Ricci: реални ревюта със снимки за гривни, колиета, часовници и кожени изделия.`
    : "Реални ревюта със снимки от клиенти на Lorenzo Ricci за гривни, колиета, часовници и кожени изделия.";
  return {
    title,
    description,
    alternates: { canonical: "/otzivi" },
    openGraph: { title: `${title} | Lorenzo Ricci`, description, url: absUrl("/otzivi") },
  };
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${fmtAvg(value)} от 5 звезди`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < full ? "text-navy" : "text-ink-faint"}>★</span>
      ))}
    </span>
  );
}

export default async function OtziviPage() {
  const rs = await getSiteReviews();
  const all = rs ?? [];
  const s = statsOf(all);

  const counts: Record<ReviewFilter, number> = {
    all: s.count,
    photos: s.withPhotos,
    jewellery: s.byCat.jewellery,
    watches: s.byCat.watches,
    leather: s.byCat.leather,
  };

  // schema.org: the shop as an Organization with the same rating + count the page shows.
  const jsonLd = s.count > 0 ? {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lorenzo Ricci",
    url: absUrl("/"),
    logo: absUrl("/logo.webp"),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(s.avg.toFixed(2)),
      reviewCount: s.count,
      bestRating: 5,
      worstRating: 1,
    },
  } : null;

  return (
    <div className="min-h-screen pt-[116px]">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}

      <div className="py-16 sm:py-20 px-5 sm:px-8 text-center border-b border-border">
        <p className="section-tag mb-4">Верифицирани ревюта</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Отзиви от клиенти</h1>
        <div className="gold-divider" />
      </div>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {s.count > 0 ? (
          <>
            {/* Summary: overall rating, count, distribution by stars */}
            <section aria-label="Обща оценка" className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 sm:gap-14 items-center mb-12 sm:mb-16">
              <div className="text-center sm:text-left">
                <p data-testid="otzivi-avg" className="font-serif text-6xl text-charcoal leading-none">{fmtAvg(s.avg)}</p>
                <Stars value={s.avg} className="text-lg mt-3" />
                <p data-testid="otzivi-count" className="font-sans text-xs font-light text-ink-muted tracking-wide mt-2">
                  от {fmtCount(s.count)} {otzivLabel(s.count)}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md mx-auto sm:mx-0">
                {s.dist.map((n, i) => {
                  const star = 5 - i;
                  const pct = s.count ? (n / s.count) * 100 : 0;
                  return (
                    <div key={star} className="grid grid-cols-[2.5rem_1fr_3.5rem] items-center gap-3 font-sans text-xs text-ink-muted">
                      <span>{star} <span className="text-navy" aria-hidden>★</span></span>
                      <div className="h-1.5 bg-border overflow-hidden" role="img" aria-label={`${star} звезди: ${fmtCount(n)}`}>
                        <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-right tabular-nums">{fmtCount(n)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <ReviewsList initial={filterReviews(all, "all").slice(0, REVIEWS_PAGE_SIZE)} counts={counts} />
          </>
        ) : (
          <p className="text-center font-sans text-sm text-ink-muted">Отзивите не могат да се заредят в момента. Опитайте отново след малко.</p>
        )}

        <div className="text-center mt-16">
          <Link href="/jewellery#damska-kolekcia" className="btn-primary">Разгледай колекцията</Link>
        </div>
      </div>
    </div>
  );
}
