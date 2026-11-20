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

export const reviewsLabel = (n: number): string => (n === 1 ? "ревю" : "ревюта");
