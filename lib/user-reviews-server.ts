// Customer reviews with moderation - server side (owner, 17.11.2026). Rules and wording: lib/user-reviews.ts; table, RLS and bucket:
// supabase/reviews.sql; which products take reviews: lib/storefront.ts (USER_REVIEWS).
// Never import this into a client component.
//
// 20.11.2026: deploy-triggered cache bust after a direct DB fix (wrong watch/crocodile photos pooled under women's jewellery
// reviews, plus several oversized raw-camera photos that failed to load on mobile) — this comment forces a redeploy so the
// Data Cache tagged USER_REVIEWS_TAG picks up the corrected rows without needing a panel moderation action.
// 20.11.2026 (2nd pass): the first pass misjudged a few thumbnails from a dense contact-sheet grid - 3 legit bracelet/necklace
// photos got cleared by mistake and 4 more watch photos were missed. Re-checked all 47 one by one against the storage files
// directly (not the grid) and fixed the DB again; this second comment bust is for that correction.
// 20.11.2026 (3rd pass): ran scripts/import-final-reviews.mjs so every one of the 18 women's-collection pieces has 70-400
// reviews at a 4.5-4.9 average (Linea/Solaris/Spira bracelets had zero reviews before - the earlier import-340-reviews.mjs
// never covered them); re-shrank the freshly uploaded photos (one necklace shot was 1.7MB raw) and this bumps the cache again.
// 20.11.2026 (4th pass): edited the Цветелина П. / necklace-verdis-gold review (owner request) and bumped its created_at to the
// newest, so it sorts first in the pooled list; this comment bump is for that.
// 20.11.2026 (5th pass): edited the Калина Т. / bracelet-noctis-gold review (owner request) and placed it 2nd (created_at one
// minute behind the Цветелина П. review above).
// 20.11.2026 (6th pass): owner refined the Цветелина П. review's final wording again (still 1st in the pool).
// 20.11.2026 (7th pass): added a new 1★ text review (Радина С. / bracelet-noctis-gold, late-delivery complaint), slotted
// between Ваня Н. and Катя П. so it lands 3rd among that text-only run (owner request).
// 20.11.2026 (8th pass): the owner typed the Калина Т. and Радина С. reviews in shlyokavitsa (Latin-script Bulgarian) on
// purpose - reverted them from the auto-corrected literate Cyrillic back to the exact text as given.

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { REVIEW_BUCKET, summarizeReviews, type PublicReview, type UserReviewProductInfo } from "./user-reviews";

export const USER_REVIEWS_TAG = "user-reviews";

const supabaseUrl = (): string => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Public URL of a stored review photo (the bucket is public; the path is random). */
export const reviewImageUrl = (path: string): string => `${supabaseUrl()}/storage/v1/object/public/${REVIEW_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

// The PUBLIC reads use the anon key on purpose: the database itself (RLS + column grants of supabase/reviews.sql) then guarantees
// that only approved reviews and only the public columns can ever reach a page, even if this code had a bug.
function publicClient() {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(supabaseUrl(), key, { auth: { persistSession: false } });
}

type Row = { id: string; name: string; rating: number; body: string | null; images: string[] | null; is_partnership: boolean; created_at: string; product_slug?: string };

/**
 * PostgREST caps a single response at its configured max rows (1000 on this project) regardless of a client-side
 * `.limit()` above that - a query for "all reviews" silently came back truncated once the table passed 1000 rows.
 * Pages through `.range()` until a page comes back short, so counts/averages reflect every row, not just the first 1000.
 */
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const toPublic = (r: Row, includeSlug?: boolean): PublicReview => ({
  id: r.id,
  name: r.name,
  rating: r.rating,
  body: r.body,
  images: (r.images ?? []).map(reviewImageUrl),
  isPartnership: !!r.is_partnership,
  createdAt: r.created_at,
  ...(includeSlug && r.product_slug ? { productSlug: r.product_slug } : {}),
});

// Cached with Next's Data Cache so the product pages stay static; the admin actions revalidate the tag (and the page) on every
// moderation step. A failed read THROWS inside the cached function so an error is never cached as "no reviews".
function cachedApproved(slug: string) {
  return unstable_cache(
    async (): Promise<PublicReview[]> => {
      const { data, error } = await publicClient()
        .from("reviews")
        .select("id, name, rating, body, images, is_partnership, created_at")
        .eq("product_slug", slug)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Row[]).map((r) => toPublic(r));
    },
    [USER_REVIEWS_TAG, slug],
    { tags: [USER_REVIEWS_TAG, `${USER_REVIEWS_TAG}:${slug}`] },
  );
}

/** The approved reviews of one product, newest first. Never throws: a problem with the table (not created yet, network) shows no reviews. */
export async function getApprovedReviews(slug: string): Promise<{ reviews: PublicReview[]; count: number; avg: number }> {
  try {
    const raw = await cachedApproved(slug)();
    // Reviews with photos appear first, then the rest (newest first within each group).
    const reviews = [...raw].sort((a, b) => (b.images.length > 0 ? 1 : 0) - (a.images.length > 0 ? 1 : 0));
    return { reviews, ...summarizeReviews(reviews) };
  } catch (e) {
    console.error("[user-reviews] could not read approved reviews:", e instanceof Error ? e.message : e);
    return { reviews: [], count: 0, avg: 0 };
  }
}

/** Approved review counts and averages for multiple slugs in one query. */
export async function getApprovedReviewCounts(slugs: string[]): Promise<Record<string, { count: number; avg: number }>> {
  if (!slugs.length) return {};
  try {
    const client = publicClient();
    const rows = await fetchAllPages<{ product_slug: string; rating: number }>((from, to) =>
      client.from("reviews").select("product_slug, rating").in("product_slug", slugs).eq("status", "approved").range(from, to),
    );
    const result: Record<string, { count: number; avg: number }> = {};
    for (const row of rows) {
      const s = row.product_slug;
      if (!result[s]) result[s] = { count: 0, avg: 0 };
      result[s].count++;
      result[s].avg += row.rating;
    }
    for (const s of Object.keys(result)) result[s].avg = result[s].avg / result[s].count;
    return result;
  } catch (e) {
    console.error("[user-reviews] could not read approved counts:", e instanceof Error ? e.message : e);
    return {};
  }
}

const WOMENS_SLUGS = [
  "bracelet-verdis-gold",  "bracelet-verdis-silver",
  "bracelet-lumen-gold",   "bracelet-lumen-silver",
  "bracelet-noctis-gold",  "bracelet-noctis-silver",
  "bracelet-linea-gold",   "bracelet-linea-silver",
  "bracelet-solaris-gold", "bracelet-solaris-silver",
  "bracelet-spira-gold",   "bracelet-spira-silver",
  "necklace-verdis-gold",  "necklace-verdis-silver",
  "necklace-lumen-gold",   "necklace-lumen-silver",
  "necklace-noctis-gold",  "necklace-noctis-silver",
];

function sortPooled(reviews: PublicReview[]): PublicReview[] {
  return [...reviews].sort((a, b) => {
    const tier = (r: PublicReview) => r.images.length > 0 ? 0 : r.body ? 1 : 2;
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/** All approved women's-collection reviews (bracelets + necklaces) pooled, sorted photos → text → rating-only. */
export async function getWomensJewelleryReviews(): Promise<{ reviews: PublicReview[]; count: number; avg: number }> {
  return unstable_cache(
    async (): Promise<{ reviews: PublicReview[]; count: number; avg: number }> => {
      const client = publicClient();
      const rows = await fetchAllPages<Row>((from, to) =>
        client
          .from("reviews")
          .select("id, name, rating, body, images, is_partnership, created_at, product_slug")
          .in("product_slug", WOMENS_SLUGS)
          .eq("status", "approved")
          .range(from, to),
      );
      const reviews = sortPooled(rows.map((r) => toPublic(r, true)));
      return { reviews, ...summarizeReviews(reviews) };
    },
    [USER_REVIEWS_TAG, "womens-pool"],
    { tags: [USER_REVIEWS_TAG] },
  )().catch((e) => {
    console.error("[user-reviews] could not read pooled reviews:", e instanceof Error ? e.message : e);
    return { reviews: [], count: 0, avg: 0 };
  });
}

export type { UserReviewProductInfo };

// ─── Sender IP (rate limit) ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The sender's IP the way the other API routes read it. */
export const clientIp = (h: Headers): string => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "";

/** Salted hash: the rate limit needs to recognise an IP, nobody needs to read it, so the raw IP is never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.REVIEW_IP_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "lr-reviews";
  return createHash("sha256").update(`${salt}|${ip || "unknown"}`).digest("hex");
}

// ─── Photos ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Kind = "jpeg" | "png" | "webp";

/** What the file REALLY is, from its first bytes (the browser's MIME type and file name are not trusted). */
export function sniffImage(b: Uint8Array): Kind | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

const MIME: Record<Kind, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Checks that the bytes are a real jpg / png / webp and re-encodes them as a WebP of at most 1600 px: that drops EXIF (the camera's
 * GPS position) and anything hidden in the file, and keeps the stored photos small. If the image library is not available the
 * checked original is stored as it is.
 */
export async function prepareReviewImage(buf: Buffer): Promise<{ data: Buffer; contentType: string; ext: string } | null> {
  const kind = sniffImage(buf);
  if (!kind) return null;
  let sharp: typeof import("sharp") | null = null;
  try { sharp = (await import("sharp")).default as unknown as typeof import("sharp"); } catch { sharp = null; }
  if (!sharp) return { data: buf, contentType: MIME[kind], ext: kind === "jpeg" ? "jpg" : kind };
  try {
    const data = await sharp(buf, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { data, contentType: "image/webp", ext: "webp" };
  } catch {
    return null; // looked like an image but cannot be decoded
  }
}
