"use client";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import type { Review } from "@/lib/types";

// Romanian counterpart of components/home/TestimonialsSection.tsx. The cards are REAL customer reviews of the Bulgarian
// store (picked on the server, see ro-testimonials.ts): author, rating and photo are the customer's own, only the text is
// translated, and the section says so once (`note`, RO_REVIEWS_NOTE). With no translated review the section is hidden.
type Item = { review: Review; productLabel?: string };

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs" role="img" aria-label={`${rating} din 5 stele`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden="true" className={i < rating ? "text-navy" : "text-ink-faint"}>
          ★
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review, productLabel }: Item) {
  return (
    <div className="flex-shrink-0 snap-start w-[85vw] sm:w-[calc(33.333%-14px)] review-card flex flex-col p-6">

      {/* Text - sits at top, takes only its natural height */}
      <div>
        <StarRating rating={review.rating} />
        {review.title && (
          <h4 className="font-serif text-lg text-charcoal leading-snug mt-3">{review.title}</h4>
        )}
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed mt-3 line-clamp-4">
          {review.body}
        </p>
      </div>

      {/* Image + Footer anchored together to the bottom - mt-auto pushes this whole block down */}
      <div className="mt-auto pt-4">
        {/* Fixed-height image box (the customer's own photo) */}
        {review.imageUrl && (
          <div className="relative w-full h-[280px] shrink-0 flex items-center justify-center border border-border bg-ivory-warm">
            <Image
              src={review.imageUrl}
              alt={`Recenzie de la ${review.author}`}
              fill
              quality={80}
              sizes="(max-width: 640px) 85vw, 33vw"
              className="object-contain"
            />
          </div>
        )}

        {/* Footer */}
        <div className={`flex justify-between items-center border-t border-border pt-3 ${review.imageUrl ? "mt-4" : ""}`}>
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs font-medium text-charcoal tracking-wide">
              {review.author}
            </span>
            {productLabel && (
              <span className="font-sans text-[10px] text-ink-faint tracking-wide">
                {productLabel}
              </span>
            )}
          </div>
          <span className="font-sans text-[10px] text-navy font-medium tracking-wide shrink-0 ml-3">
            ✓ Verificat
          </span>
        </div>
      </div>

    </div>
  );
}

export function RoTestimonialsSection({ items, note }: { items: Item[]; note: string }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const checkScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
  }, [items.length]);

  const scroll = (dir: "prev" | "next") => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.offsetWidth / (window.innerWidth >= 640 ? 3 : 1) + 20;
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "smooth" });
    setTimeout(checkScroll, 550);
  };

  // Nothing translated yet: no empty section
  if (items.length === 0) return null;

  return (
    <section className="py-28 sm:py-40 bg-ivory-warm border-y border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-tag mb-4">Recenzii verificate</p>
          <h2 className="section-title mb-4">Ce spun clienții noștri</h2>
          <div className="gold-divider" />
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="text-navy text-sm">★★★★★</span>
            <span className="font-sans text-sm font-light text-ink-muted">4,8 din 5</span>
          </div>
          <p className="font-sans text-xs font-light text-ink-faint tracking-wide mt-3">{note}</p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Prev */}
          <button
            onClick={() => scroll("prev")}
            className={`hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canPrev ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Recenzia anterioară"
          >
            <span className="text-xl leading-none text-charcoal">‹</span>
          </button>

          {/* Track */}
          <div
            ref={carouselRef}
            onScroll={checkScroll}
            className={`flex items-stretch gap-5 overflow-x-auto snap-x snap-mandatory ${items.length < 3 ? "sm:justify-center" : ""}`}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {items.map(({ review, productLabel }) => (
              <ReviewCard key={review.id} review={review} productLabel={productLabel} />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => scroll("next")}
            className={`hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-border items-center justify-center shadow-sm hover:bg-ivory-warm transition-all duration-200 ${
              canNext ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Recenzia următoare"
          >
            <span className="text-xl leading-none text-charcoal">›</span>
          </button>
        </div>

        {/* Dot indicators (mobile) */}
        <div className="flex justify-center gap-1.5 mt-6 sm:hidden">
          {items.map(({ review }) => (
            <div key={review.id} className="w-1.5 h-1.5 rounded-full bg-border" />
          ))}
        </div>
      </div>
    </section>
  );
}
