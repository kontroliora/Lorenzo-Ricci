"use client";
import Image from "next/image";
import type { Review } from "@/lib/types";
import { useReveal } from "@/lib/useReveal";
import { roReviewsCount, roRatingText } from "@/components/ro/product/ro-text";

// Romanian counterpart of components/product/ProductReviews.tsx. The reviews were written by customers of the BULGARIAN store:
// the people, ratings, dates and photos are exactly as they are; only the text is translated and the name transliterated to Latin
// letters (lib/ro/reviews-ro.ts). The page passes ONLY the reviews that have a Romanian text, already localized.
interface Props {
  reviews: Review[];        // localized reviews (Romanian text), dataset order
  count: number;            // number of reviews: the hand-kept summary (full dataset) first, else the product's own reviews
  avg: number;              // average rating, 1-5
  translated: boolean;      // every review of the product has a Romanian text: the numbers then need no "(Bulgaria)" label
  note: string;             // RO_REVIEWS_NOTE, shown under the heading
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-navy text-xs" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-navy" : "text-ink-faint"}>★</span>
      ))}
    </div>
  );
}

// At most this many reviews are listed; reviews with a photo always come first.
const MAX_REVIEWS = 20;
const byDateDesc = (a: Review, b: Review) => new Date(b.date).getTime() - new Date(a.date).getTime();

// Renders nothing for a product that has no reviews.
export function RoProductReviews({ reviews, count, avg, translated, note }: Props) {
  const gridRef = useReveal();
  if (count <= 0 && reviews.length === 0) return null;

  const totalCount = Math.max(count, reviews.length);
  const summaryText = `${roRatingText(avg)} · ${roReviewsCount(totalCount)}${translated ? "" : " ale clienților (Bulgaria)"}`;

  // Sort logic (same as the Bulgarian page):
  // 1. Reviews with photo - always shown, newest first
  // 2. Fill the remaining slots (up to 20 in total) with text-only reviews, newest first
  const withPhoto    = [...reviews.filter((r) => r.imageUrl)].sort(byDateDesc);
  const withoutPhoto = [...reviews.filter((r) => !r.imageUrl)].sort(byDateDesc);
  const textSlots    = Math.max(0, MAX_REVIEWS - withPhoto.length);
  const visibleReviews = [...withPhoto, ...withoutPhoto.slice(0, textSlots)];

  return (
    <section id="reviews" className="py-16 border-t border-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <h2 className="font-serif text-2xl text-charcoal mb-1">Recenzii</h2>
          {/* The origin note belongs to the listed (translated) reviews; a summary alone is labelled "(Bulgaria)" instead. */}
          {reviews.length > 0 && (
            <p className="font-sans text-[11px] font-light text-ink-faint tracking-wide mb-3">{note}</p>
          )}
          <div className="flex items-center gap-3" role="img" aria-label={`Evaluare medie ${roRatingText(avg)} din 5, ${roReviewsCount(totalCount)}${translated ? "" : " ale clienților (Bulgaria)"}`}>
            <Stars rating={Math.round(avg)} />
            <span className="font-sans text-xs text-ink-muted">{summaryText}</span>
          </div>
        </div>
      </div>

      {/* Reviews grid - photos first */}
      {visibleReviews.length > 0 && (
        <div ref={gridRef} className="columns-1 sm:columns-2 gap-5">
          {visibleReviews.map((review, i) => (
            <div
              key={review.id}
              className={`reveal reveal-delay-${Math.min(i + 1, 6)} review-card break-inside-avoid mb-5 inline-block w-full flex flex-col gap-3 p-5`}
            >
              <Stars rating={review.rating} />
              {review.title && (
                <h4 className="font-serif text-lg text-charcoal">{review.title}</h4>
              )}
              <p className="font-sans text-sm font-light text-ink-soft leading-relaxed flex-1">
                {review.body?.replace(/[–—]/g, "-") ?? ""}
              </p>
              {review.imageUrl && (
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-ivory-warm">
                  <Image
                    src={review.imageUrl}
                    alt={`Fotografie trimisă de ${review.author}`}
                    fill
                    quality={75}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain object-center p-2"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="font-sans text-xs font-medium text-charcoal">{review.author}</p>
                <span className="font-sans text-[10px] text-navy font-medium tracking-wide">✓ Achiziție verificată</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
