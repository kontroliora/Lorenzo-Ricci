import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/products";
import { userReviewsOn } from "@/lib/storefront";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_BUCKET, REVIEW_LIMITS, validateReviewInput } from "@/lib/user-reviews";
import { clientIp, hashIp, prepareReviewImage } from "@/lib/user-reviews-server";
import { notifyNewReview } from "@/lib/review-notify";
import { getApprovedReviews } from "@/lib/user-reviews-server";

// (The only e-mail this route sends goes to the owner, through lib/review-notify.ts, which declares its own mail-policy.)

// POST /api/product-review  (multipart/form-data) - a customer's new review of a product page of the Bulgarian shop.
// The review is saved as 'pending' and is invisible until the owner approves it in the panel. Checks, in order:
//   1. honeypot field "website" (a human never sees it; a bot fills it -> we answer "ok" and save nothing);
//   2. the product exists AND its group takes reviews (lib/storefront.ts USER_REVIEWS);
//   3. every text field (lib/user-reviews.ts validateReviewInput, the same rules the form shows);
//   4. rate limit: 3 reviews per IP per hour (salted IP hash in reviews.ip_hash);
//   5. photos: at most 3, jpg / png / webp by their REAL bytes, 5 MB each, re-encoded (no EXIF).
// The old /api/review (used by the Romanian pages) is not touched.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, error: string, errors?: Record<string, string>) => NextResponse.json({ ok: false, error, ...(errors ? { errors } : {}) }, { status });

// GET /api/product-review?slug=<slug> - read only: the APPROVED reviews of one product of the women's collection, for the product page that
// switches pieces in place (components/product/CollectionReviews.tsx). Same source as the page itself (getApprovedReviews: anon key + RLS, so
// nothing but approved reviews and public columns can ever leave), same rule (only a product whose group takes reviews). Answers
// { ok, enabled:false } for a product that takes none, so the page simply shows no section for it. Cached briefly at the CDN; a moderation
// step shows within a minute.
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  const product = slug ? getProductBySlug(slug) : undefined;
  if (!product) return NextResponse.json({ ok: false, error: "Непознат продукт." }, { status: 404 });
  const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
  if (!userReviewsOn(product)) return NextResponse.json({ ok: true, enabled: false }, { headers });
  const { reviews, count, avg } = await getApprovedReviews(slug);
  return NextResponse.json({ ok: true, enabled: true, reviews, count, avg }, { headers });
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return fail(400, "Невалидна заявка."); }
  const str = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };

  // 1. honeypot
  if (str("website").trim()) return NextResponse.json({ ok: true });

  // 2. product
  const slug = str("productSlug").trim();
  const product = slug ? getProductBySlug(slug) : undefined;
  if (!product || !userReviewsOn(product)) return fail(404, "За този продукт не се приемат ревюта.");

  // 3. text fields
  const parsed = validateReviewInput({ name: form.get("name"), rating: form.get("rating"), body: form.get("body"), email: form.get("email") });
  if (!parsed.ok) return fail(400, "Проверете полетата.", parsed.errors as Record<string, string>);
  const v = parsed.value;

  const files = form.getAll("images").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (files.length > REVIEW_LIMITS.maxImages) return fail(400, `Можете да добавите до ${REVIEW_LIMITS.maxImages} снимки.`);
  for (const f of files) {
    if (f.size > REVIEW_LIMITS.maxImageBytes) return fail(400, "Всяка снимка може да е до 5MB.");
  }

  const sb = supabaseAdmin();

  // 4. rate limit (counts reviews that were saved)
  const ipHash = hashIp(clientIp(req.headers));
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await sb.from("reviews").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if (recent.error) { console.error("[product-review] rate-limit read failed:", recent.error.message); return fail(503, "Ревютата не са достъпни в момента. Опитайте по-късно."); }
  if ((recent.count ?? 0) >= REVIEW_LIMITS.perIpPerHour) return fail(429, "Изпратили сте няколко ревюта наскоро. Опитайте отново след малко.");

  // 5. photos
  const id = randomUUID();
  const stored: string[] = [];
  const cleanup = async () => { if (stored.length) await sb.storage.from(REVIEW_BUCKET).remove(stored).catch(() => undefined); };
  for (const f of files) {
    const prepared = await prepareReviewImage(Buffer.from(await f.arrayBuffer()));
    if (!prepared) { await cleanup(); return fail(400, "Снимките трябва да са JPG, PNG или WEBP."); }
    const path = `${id}/${randomUUID()}.${prepared.ext}`;
    const up = await sb.storage.from(REVIEW_BUCKET).upload(path, prepared.data, { contentType: prepared.contentType, upsert: false, cacheControl: "31536000" });
    if (up.error) { console.error("[product-review] upload failed:", up.error.message); await cleanup(); return fail(500, "Снимката не можа да се качи. Опитайте отново."); }
    stored.push(path);
  }

  const ins = await sb.from("reviews").insert({
    id, product_slug: product.slug, name: v.name, rating: v.rating, body: v.body, images: stored, email: v.email, status: "pending", ip_hash: ipHash,
  });
  if (ins.error) {
    console.error("[product-review] insert failed:", ins.error.message);
    await cleanup();
    return fail(500, "Ревюто не можа да се запази. Опитайте отново.");
  }

  // e-mail to the owner (never blocks or fails the review)
  await notifyNewReview({ productSlug: product.slug, productName: product.name, name: v.name, rating: v.rating, body: v.body, email: v.email, photos: stored.length });

  return NextResponse.json({ ok: true });
}
