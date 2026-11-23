// Site-wide review numbers and list items - the types and formatting shared by server and client (owner, 23.11.2026).
// The data itself comes from lib/site-reviews.ts (server only).

export type ReviewCat = "jewellery" | "watches" | "leather";

export const REVIEW_CAT_LABEL: Record<ReviewCat, string> = { jewellery: "Бижута", watches: "Часовници", leather: "Кожа" };

/** One review as the site shows it, whichever store it comes from (moderated DB reviews or the older lib/reviews.ts ones). */
export interface SiteReview {
  id: string;
  name: string;
  rating: number;
  body: string | null;
  images: string[];
  date: string; // ISO
  productSlug: string;
  productName: string;
  cat: ReviewCat;
}

/** The ONE rating + count every place on the site shows (hero line, trust bar, reviews section, footer, cart, /otzivi). */
export interface ReviewStats {
  count: number;
  avg: number;
  dist: [number, number, number, number, number]; // count of 5★, 4★, 3★, 2★, 1★
  withPhotos: number;
  byCat: Record<ReviewCat, number>;
}

export type ReviewFilter = "all" | "photos" | ReviewCat;

/** "4,8" */
export const fmtAvg = (avg: number): string => (Math.round(avg * 10) / 10).toFixed(1).replace(".", ",");
/** "2 947" (non-breaking space between thousands) */
export const fmtCount = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** "отзив" / "отзива" */
export const otzivLabel = (n: number): string => (n === 1 ? "отзив" : "отзива");

export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};

export const REVIEWS_PAGE_SIZE = 24;
