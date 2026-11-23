"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { fmtAvg, fmtCount, otzivLabel, fmtDate, type ReviewStats, type SiteReview } from "@/lib/site-reviews-shared";

// Home "Какво казват клиентите" (owner, 23.11.2026): right after "Дамска колекция"; reviews WITH photos first, then written ones
// (picked on the server, lib/site-reviews.ts homeReviews), and a button to /otzivi. Rating and count: the one site-wide source.

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs" aria-label={`${rating} от 5 звезди`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < rating ? "text-navy" : "text-ink-faint"}>
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: SiteReview }) {
  const photo = review.images[0];
  const local = photo?.startsWith("/");
  return (
    <div className="flex-shrink-0 snap-start w-[85vw] sm:w-[calc(33.333%-14px)] review-card flex flex-col p-6">
      <div>
        <StarRating rating={review.rating} />
        {review.body && (
          <p className="font-sans text-sm font-light text-ink-soft leading-relaxed mt-3 line-clamp-4">{review.body}</p>
        )}
      </div>

      <div className="mt-auto pt-4">
        {photo && (
          <div className="relative w-full h-[280px] shrink-0 flex items-center justify-center border border-border bg-ivory-warm">
            {local ? (
              <Image src={photo} alt={`Снимка от ${review.name}`} fill quality={80} sizes="(max-width: 640px) 85vw, 33vw" className="object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={`Снимка от ${review.name}`} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-contain" />
            )}
          </div>
        )}

        <div className="flex justify-between items-center border-t border-border pt-3 mt-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-sans text-xs font-medium text-charcoal tracking-wide">{review.name}</span>
            <Link href={`/products/${review.productSlug}`} className="font-sans text-[10px] text-ink-faint tracking-wide hover:text-navy truncate">
              {review.productName}
            </Link>
          </div>
          <span className="font-sans text-[10px] text-ink-faint tracking-wide shrink-0 ml-3">{fmtDate(review.date)}</span>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection({ reviews, stats }: { reviews: SiteReview[]; stats: ReviewStats | null }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const sorted = reviews;

  const checkScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
  }, []);

  const scroll = (dir: "prev" | "next") => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.offsetWidth / (window.innerWidth >= 640 ? 3 : 1) + 20;
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "smooth" });
    setTimeout(checkScroll, 550);
  };

  // No review left for the products on the shelf: no section (rather than reviews of products that are not sold).
  if (sorted.length === 0) return null;

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-tag mb-4">Верифицирани Ревюта</p>
          <h2 className="section-title mb-4">Какво казват клиентите</h2>
          <div className="gold-divider" />
          {stats && (
            <Link href="/otzivi" className="flex items-center justify-center gap-3 mt-6 group">
              <span className="text-navy text-sm" aria-hidden>★★★★★</span>
              <span className="font-sans text-sm font-light text-ink-muted group-hover:text-navy transition-colors">
                {fmtAvg(stats.avg)} от 5 · {fmtCount(stats.count)} {otzivLabel(stats.count)}
              </span>
            </Link>
          )}
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Prev */}
          <button
            onClick={() => scroll("prev")}
            className={`hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canPrev ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Предишно"
          >
            <span className="text-xl leading-none text-charcoal">‹</span>
          </button>

          {/* Track */}
          <div
            ref={carouselRef}
            onScroll={checkScroll}
            className="flex items-stretch gap-5 overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {sorted.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => scroll("next")}
            className={`hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canNext ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Следващо"
          >
            <span className="text-xl leading-none text-charcoal">›</span>
          </button>
        </div>

        {/* Dot indicators (mobile) */}
        <div className="flex justify-center gap-1.5 mt-6 sm:hidden">
          {sorted.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-border" />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/otzivi" className="btn-outline inline-block text-xs">Виж всички отзиви</Link>
        </div>
      </div>
    </section>
  );
}
