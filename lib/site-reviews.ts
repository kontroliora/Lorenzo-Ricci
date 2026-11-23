// The ONE source of the site's review numbers and of the review list on /otzivi (owner, 23.11.2026). Before this the home trust
// bar and reviews section had a hand-typed "3178", the footer "1000+", the admin 2 449 approved.
//
// What counts: every review that actually exists and can be shown, of a product that is on the shop window (lib/products.ts
// `products`, which follows lib/storefront.ts SHELF):
//   - the approved moderated reviews (table `reviews`, supabase/reviews.sql) - today the women's collection, ~2 450;
//   - the older reviews written in lib/reviews.ts (watches, leather, men's jewellery), ~497.
// NOT the per-product badge numbers of lib/reviews.ts `reviewSummary` / lib/user-reviews.ts displayReviewCount: those claim more
// reviews than exist and are cosmetic per-product badges only.
//
// Server only (reads the database). The moderated part refreshes on every panel moderation step (revalidateTag(USER_REVIEWS_TAG)) and at least hourly.
import { reviews as legacyReviews } from "./reviews";
import { getProductBySlug } from "./products";
import { getAllApprovedReviews } from "./user-reviews-server";
import type { ProductCategory } from "./types";
import type { ReviewCat, ReviewFilter, ReviewStats, SiteReview } from "./site-reviews-shared";

const catOf = (c: ProductCategory): ReviewCat => (c === "watches" ? "watches" : c === "jewellery" ? "jewellery" : "leather");

const tier = (r: SiteReview): number => (r.images.length > 0 ? 0 : r.body ? 1 : 2);

/** Photos first, then written reviews, then rating-only; newest first inside each group. */
function sortReviews(rs: SiteReview[]): SiteReview[] {
  return [...rs].sort((a, b) => tier(a) - tier(b) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

let warned = false;

/** Every showable review, sorted. null when the database could not be read (callers then hide the numbers, never show a wrong one). */
export async function getSiteReviews(): Promise<SiteReview[] | null> {
  let db;
  try {
    db = await getAllApprovedReviews();
  } catch (e) {
    if (!warned) { warned = true; console.error("[site-reviews] could not read approved reviews:", e instanceof Error ? e.message : e); }
    return null;
  }
  const out: SiteReview[] = [];
  for (const r of db) {
    const p = getProductBySlug(r.productSlug);
    if (!p) continue;
    out.push({ id: `u-${r.id}`, name: r.name, rating: r.rating, body: r.body?.trim() || null, images: r.images, date: r.createdAt, productSlug: p.slug, productName: p.name, cat: catOf(p.category) });
  }
  for (const r of legacyReviews) {
    const p = getProductBySlug(r.productSlug);
    if (!p) continue;
    out.push({ id: `s-${r.id}`, name: r.author, rating: r.rating, body: r.body?.trim() || null, images: r.imageUrl ? [r.imageUrl] : [], date: r.date, productSlug: p.slug, productName: p.name, cat: catOf(p.category) });
  }
  return sortReviews(out);
}

export function statsOf(rs: SiteReview[]): ReviewStats {
  const dist: ReviewStats["dist"] = [0, 0, 0, 0, 0];
  const byCat: ReviewStats["byCat"] = { jewellery: 0, watches: 0, leather: 0 };
  let sum = 0, withPhotos = 0;
  for (const r of rs) {
    sum += r.rating;
    dist[5 - r.rating]++;
    byCat[r.cat]++;
    if (r.images.length) withPhotos++;
  }
  return { count: rs.length, avg: rs.length ? sum / rs.length : 0, dist, withPhotos, byCat };
}

/** The site-wide rating and count, or null when unknown (then no number is shown anywhere). */
export async function getReviewStats(): Promise<ReviewStats | null> {
  const rs = await getSiteReviews();
  return rs && rs.length ? statsOf(rs) : null;
}

export function filterReviews(rs: SiteReview[], f: ReviewFilter): SiteReview[] {
  if (f === "all") return rs;
  if (f === "photos") return rs.filter((r) => r.images.length > 0);
  return rs.filter((r) => r.cat === f);
}

/** The home "Какво казват клиентите" carousel: reviews with photos first (women's collection first), then written ones. */
export function homeReviews(rs: SiteReview[], photos = 12, texts = 6): SiteReview[] {
  const withPhoto = rs.filter((r) => r.images.length > 0);
  const photoSorted = [...withPhoto.filter((r) => r.id.startsWith("u-")), ...withPhoto.filter((r) => !r.id.startsWith("u-"))];
  const written = rs.filter((r) => !r.images.length && r.body && r.body.length >= 40 && r.rating >= 4);
  return [...photoSorted.slice(0, photos), ...written.slice(0, texts)];
}
