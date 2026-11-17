// Customer reviews with moderation - server side (owner, 17.11.2026). Rules and wording: lib/user-reviews.ts; table, RLS and bucket:
// supabase/reviews.sql; which products take reviews: lib/storefront.ts (USER_REVIEWS).
// Never import this into a client component.

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { REVIEW_BUCKET, summarizeReviews, type PublicReview } from "./user-reviews";

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

type Row = { id: string; name: string; rating: number; body: string; images: string[] | null; is_partnership: boolean; created_at: string };

const toPublic = (r: Row): PublicReview => ({
  id: r.id,
  name: r.name,
  rating: r.rating,
  body: r.body,
  images: (r.images ?? []).map(reviewImageUrl),
  isPartnership: !!r.is_partnership,
  createdAt: r.created_at,
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
      return ((data ?? []) as Row[]).map(toPublic);
    },
    [USER_REVIEWS_TAG, slug],
    { tags: [USER_REVIEWS_TAG, `${USER_REVIEWS_TAG}:${slug}`] },
  );
}

/** The approved reviews of one product, newest first. Never throws: a problem with the table (not created yet, network) shows no reviews. */
export async function getApprovedReviews(slug: string): Promise<{ reviews: PublicReview[]; count: number; avg: number }> {
  try {
    const reviews = await cachedApproved(slug)();
    return { reviews, ...summarizeReviews(reviews) };
  } catch (e) {
    console.error("[user-reviews] could not read approved reviews:", e instanceof Error ? e.message : e);
    return { reviews: [], count: 0, avg: 0 };
  }
}

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
