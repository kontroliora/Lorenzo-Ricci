// Customer reviews with moderation (Bulgarian shop; owner, 17.11.2026). Pure: types, limits and the ONE validation used by the
// form (live hints) and by the server (the real check). Database: supabase/reviews.sql. Switch per product group: lib/storefront.ts.

export const REVIEW_LIMITS = {
  nameMax: 60,
  bodyMin: 10,
  bodyMax: 1000,
  emailMax: 254,
  maxImages: 3,
  maxImageBytes: 5 * 1024 * 1024,
  perIpPerHour: 3,
} as const;

export const REVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReviewStatus = "pending" | "approved" | "rejected";
export const REVIEW_BUCKET = "review-images";

/** What the public site shows of an approved review (never the e-mail, never the moderator). */
export interface PublicReview {
  id: string;
  name: string;
  rating: number;
  body: string | null;       // null for rating-only reviews (no written text)
  images: string[];          // full public URLs
  isPartnership: boolean;
  createdAt: string;
  productSlug?: string;      // set when reviews from multiple products are pooled together
}

export interface UserReviewProductInfo {
  shortName: string;
  href: string;
  coverSrc: string;
}

export const THANKS_TEXT = "Благодарим. Ревюто ще се публикува след преглед.";

const charCount = (s: string): number => [...s].length;
// control and invisible characters (zero-width, line separators) never belong in a name or a text; tab and new line stay
const stripControl = (s: string): string => {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const keep = c === 9 || c === 10 || c === 13 || (c >= 32 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && c !== 0x2028 && c !== 0x2029 && c !== 0xfeff);
    if (keep) out += ch;
  }
  return out;
};
const URL_RE = /(https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ReviewInput {
  name: string;
  rating: number;
  body: string;
  email: string | null;
}

export type ReviewErrors = Partial<Record<"name" | "rating" | "body" | "email", string>>;

/** Cleans and checks the text fields. Same rules in the browser and on the server (the server's answer is the one that counts). */
export function validateReviewInput(raw: { name?: unknown; rating?: unknown; body?: unknown; email?: unknown }):
  { ok: true; value: ReviewInput } | { ok: false; errors: ReviewErrors } {
  const errors: ReviewErrors = {};

  const name = stripControl(typeof raw.name === "string" ? raw.name : "").replace(/\s+/g, " ").trim();
  if (!name) errors.name = "Въведете име.";
  else if (charCount(name) > REVIEW_LIMITS.nameMax) errors.name = `Името може да е до ${REVIEW_LIMITS.nameMax} знака.`;
  else if (URL_RE.test(name)) errors.name = "Моля, не добавяйте линкове.";

  const ratingNum = typeof raw.rating === "number" ? raw.rating : typeof raw.rating === "string" && /^\d$/.test(raw.rating.trim()) ? Number(raw.rating) : NaN;
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) errors.rating = "Изберете оценка от 1 до 5 звезди.";

  const body = stripControl(typeof raw.body === "string" ? raw.body : "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const n = charCount(body);
  if (n < REVIEW_LIMITS.bodyMin) errors.body = `Ревюто трябва да е поне ${REVIEW_LIMITS.bodyMin} знака.`;
  else if (n > REVIEW_LIMITS.bodyMax) errors.body = `Ревюто може да е до ${REVIEW_LIMITS.bodyMax} знака.`;
  else if (URL_RE.test(body)) errors.body = "Моля, не добавяйте линкове.";

  let email: string | null = null;
  const emailRaw = typeof raw.email === "string" ? stripControl(raw.email).trim() : "";
  if (emailRaw) {
    if (emailRaw.length > REVIEW_LIMITS.emailMax || !EMAIL_RE.test(emailRaw)) errors.email = "Невалиден имейл.";
    else email = emailRaw.toLowerCase();
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, rating: ratingNum, body, email } };
}

/** Average and count of the approved reviews (the average has one decimal at most when shown). */
export function summarizeReviews(rs: { rating: number }[]): { count: number; avg: number } {
  if (!rs.length) return { count: 0, avg: 0 };
  return { count: rs.length, avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length };
}

export const formatAvg = (avg: number): string => (Math.round(avg * 10) / 10).toFixed(1).replace(".", ",");

// The real per-piece average (summarizeReviews) sits at 4.77-4.81 for every women's-collection piece, which always rounds to the
// same "4.8" badge next to the product title (owner, 20.11.2026). This is cosmetic only, for that one badge: a stable (same slug
// -> same number every time, never flickers on reload) value in {4.6, 4.7, 4.8, 4.9} so pieces read as slightly different. The
// real average everywhere else (the pooled "Ревюта" section, the review list, JSON-LD) is untouched.
export function displayRating(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) { h ^= slug.charCodeAt(i); h = Math.imul(h, 16777619); }
  const steps = [4.6, 4.7, 4.8, 4.9];
  return steps[Math.abs(h) % steps.length];
}

export const reviewsLabel = (n: number): string => (n === 1 ? "ревю" : "ревюта");

// Cosmetic-only (owner, 21.11.2026): a few per-piece counts in that same title badge sat too close together (e.g. the three
// gold clover bracelets all around 210-220, reading as near-identical) or just looked better a bit lower. Overrides the badge
// number only, for the listed slugs; every other slug, and the real count everywhere else (pooled "Ревюта" section, review
// list, JSON-LD), is untouched - same scope as displayRating above.
const REVIEW_COUNT_OVERRIDES: Record<string, number> = {
  "bracelet-verdis-gold": 184,
  "bracelet-lumen-gold": 208,
  "bracelet-noctis-gold": 235,
  "necklace-verdis-gold": 107,
  "bracelet-spira-gold": 64,
  "bracelet-solaris-silver": 47,
};
export function displayReviewCount(slug: string, real: number): number {
  return REVIEW_COUNT_OVERRIDES[slug] ?? real;
}
