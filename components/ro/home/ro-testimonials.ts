// SERVER-SIDE ONLY (imported by app/ro/page.tsx): picks the home-page testimonials from the real customer reviews
// (lib/reviews.ts) and hands the client section a small serializable list, so the 300 reviews never reach the browser.
// Only reviews that have a Romanian text (localizeReview, lib/ro/reviews-ro.ts) are eligible: people, ratings, dates and
// photos are the real ones, only the text is translated and the name is written in Latin letters. Nothing is invented.
import { reviews } from "@/lib/reviews";
import { products } from "@/lib/products";
import { localizeReview } from "@/lib/ro/reviews-ro";
import type { Review } from "@/lib/types";
import { hasCyrillic, safeText } from "./ro-home-utils";

export type RoTestimonial = { review: Review; productLabel?: string };

const LIMIT = 7; // same number of cards as the Bulgarian carousel

// Shown first, in this order, when they have a Romanian text: the real counterparts of the Bulgarian home carousel.
const CURATED_IDS = ["r-15", "r-25", "r-26", "r-110", "r-151", "r-2"];

// Jewellery names stay Bulgarian in the catalogue (names are not part of the Romanian overlay), so the label is written here.
const JEWELLERY_LABEL: Record<string, string> = {
  "bracelet-diamante-cross": "Brățară Diamante Cross",
  "bracelet-milano-forte": "Brățară Milano Forte",
  "bracelet-milano-twist": "Brățară Milano Twist",
  "bracelet-signature": "Brățară Signature",
  "necklace-aurelius": "Colier Aurelius Cross",
  "necklace-grande-imperiale": "Colier Grande Imperiale",
  "necklace-milano-forte": "Colier Milano Forte",
  "necklace-milano-twist": "Colier Milano Twist",
};

const productLabel = (slug: string): string | undefined =>
  JEWELLERY_LABEL[slug] ?? safeText(products.find((p) => p.slug === slug)?.name);

export function pickRoTestimonials(limit = LIMIT): RoTestimonial[] {
  const eligible = new Map<string, Review>();
  for (const r of reviews) {
    const ro = localizeReview(r);
    if (!ro || !ro.body || ro.rating < 4) continue;
    if (hasCyrillic(ro.author) || hasCyrillic(ro.body) || (ro.title && hasCyrillic(ro.title))) continue; // never show foreign script
    eligible.set(ro.id, ro);
  }

  const picked: Review[] = [];
  for (const id of CURATED_IDS) {
    const r = eligible.get(id);
    if (r) { picked.push(r); eligible.delete(id); }
  }

  // Fill the rest: five-star reviews with a customer photo first, newest first.
  const rest = [...eligible.values()]
    .filter((r) => r.rating === 5)
    .sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  picked.push(...rest);

  return picked.slice(0, limit).map((review) => ({ review, productLabel: productLabel(review.productSlug) }));
}
