"use client";
import { useEffect, useState } from "react";
import { UserReviews } from "@/components/product/UserReviews";
import { useActiveSlug } from "@/components/product/CollectionProductView";
import type { PublicReview, UserReviewProductInfo } from "@/lib/user-reviews";

// The "Ревюта" section of a women's-collection page (Bulgarian shop) that follows step 1.
// When `pool` is provided the section shows ALL approved women's-jewellery reviews (bracelets + necklaces)
// with a "за <model>" label under each review; the write form still targets the active piece.
// Without `pool` it falls back to the original per-piece behaviour.
export type ReviewsOf = { reviews: PublicReview[]; count: number; avg: number };
export type ReviewPool = ReviewsOf & { productInfo: Record<string, UserReviewProductInfo> };

const fetched = new Map<string, ReviewsOf | null>(); // per slug for this page's lifetime; null = that piece takes no reviews

export function CollectionReviews({ pageSlug, initial, pool }: { pageSlug: string; initial: ReviewsOf | null; pool?: ReviewPool }) {
  const slug = useActiveSlug(pageSlug);
  const [data, setData] = useState<{ slug: string; of: ReviewsOf | null } | null>(null);

  useEffect(() => {
    if (pool) return; // pooled mode: no per-piece fetching needed
    if (slug === pageSlug) return;
    if (fetched.has(slug)) { setData({ slug, of: fetched.get(slug) ?? null }); return; }
    let cancelled = false;
    fetch(`/api/product-review?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; enabled?: boolean; reviews?: PublicReview[]; count?: number; avg?: number } | null) => {
        if (!d?.ok) return;
        const of = d.enabled ? { reviews: d.reviews ?? [], count: d.count ?? 0, avg: d.avg ?? 0 } : null;
        fetched.set(slug, of);
        if (!cancelled) setData({ slug, of });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, pageSlug, pool]);

  if (pool) {
    if (!pool.count) return null;
    return (
      <div className="mt-20">
        <UserReviews key={slug} productSlug={slug} reviews={pool.reviews} count={pool.count} avg={pool.avg} productInfo={pool.productInfo} />
      </div>
    );
  }

  const of = slug === pageSlug ? initial : data?.slug === slug ? data.of : null;
  if (!of) return null;
  return (
    <div className="mt-20">
      <UserReviews key={slug} productSlug={slug} reviews={of.reviews} count={of.count} avg={of.avg} />
    </div>
  );
}
