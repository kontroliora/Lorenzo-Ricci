"use client";
import { useEffect, useState } from "react";
import { UserReviews } from "@/components/product/UserReviews";
import { useActiveSlug } from "@/components/product/CollectionProductView";
import type { PublicReview } from "@/lib/user-reviews";

// The "Ревюта" section of a women's-collection page (Bulgarian shop) that follows step 1: it shows the approved reviews of the piece step
// 1 currently shows, and its form sends the review to THAT piece. The page's own piece comes from the server render (`initial`); another
// piece is read from GET /api/product-review?slug= (read only, same source). A piece whose group takes no reviews shows no section.
export type ReviewsOf = { reviews: PublicReview[]; count: number; avg: number };

const fetched = new Map<string, ReviewsOf | null>(); // per slug for this page's lifetime; null = that piece takes no reviews

export function CollectionReviews({ pageSlug, initial }: { pageSlug: string; initial: ReviewsOf | null }) {
  const slug = useActiveSlug(pageSlug);
  const [data, setData] = useState<{ slug: string; of: ReviewsOf | null } | null>(null);

  useEffect(() => {
    if (slug === pageSlug) return;
    if (fetched.has(slug)) { setData({ slug, of: fetched.get(slug) ?? null }); return; }
    let cancelled = false;
    fetch(`/api/product-review?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; enabled?: boolean; reviews?: PublicReview[]; count?: number; avg?: number } | null) => {
        if (!d?.ok) return; // not answered: show nothing rather than another piece's reviews
        const of = d.enabled ? { reviews: d.reviews ?? [], count: d.count ?? 0, avg: d.avg ?? 0 } : null;
        fetched.set(slug, of);
        if (!cancelled) setData({ slug, of });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, pageSlug]);

  // Never a piece's reviews under another piece's page: until the answer for THIS piece is there, nothing is shown.
  const of = slug === pageSlug ? initial : data?.slug === slug ? data.of : null;
  if (!of) return null;
  return (
    <div className="mt-20">
      <UserReviews key={slug} productSlug={slug} reviews={of.reviews} count={of.count} avg={of.avg} />
    </div>
  );
}
