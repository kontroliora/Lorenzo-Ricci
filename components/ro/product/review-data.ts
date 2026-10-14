import type { Review } from "@/lib/types";
import { getReviewsBySlug, reviewSummary } from "@/lib/reviews";
import { localizeReview } from "@/lib/ro/reviews-ro";

// Server-side helper for the Romanian product page (imports the Bulgarian review dataset, so client components must not import
// this file: the page computes the view and passes it down as props).

export type RoReviewView = {
  /** The product's reviews that have a Romanian text (localizeReview), in dataset order. */
  reviews: Review[];
  /** Number of reviews / average, exactly as the Bulgarian page: the hand-kept summary (full dataset) first, else the product's own reviews. */
  count: number;
  avg: number;
  /** Every review of the product has a Romanian text: the numbers are then shown without the "(Bulgaria)" label. */
  allTranslated: boolean;
  /** For JSON-LD aggregateRating: same condition as the Bulgarian page (only when the product really has reviews and a summary). */
  ldSummary: { count: number; avg: number } | null;
};

export function roReviewView(slug: string): RoReviewView {
  const all = getReviewsBySlug(slug);
  const summary = reviewSummary[slug];
  const reviews = all.map(localizeReview).filter((r): r is Review => r !== null);
  const count = summary?.count ?? all.length;
  const avg = summary?.avg ?? (all.length > 0 ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0);
  return {
    reviews,
    count,
    avg,
    allTranslated: all.length > 0 && reviews.length === all.length,
    ldSummary: all.length > 0 && summary ? summary : null,
  };
}
