// Next page of the /otzivi list ("Покажи още" and the filters). Public, read-only, approved reviews only (lib/site-reviews.ts).
import { NextResponse } from "next/server";
import { getSiteReviews, filterReviews } from "@/lib/site-reviews";
import { REVIEWS_PAGE_SIZE, type ReviewFilter } from "@/lib/site-reviews-shared";

const FILTERS: ReviewFilter[] = ["all", "photos", "jewellery", "watches", "leather"];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const f = (FILTERS as string[]).includes(sp.get("f") ?? "") ? (sp.get("f") as ReviewFilter) : "all";
  const offset = Math.max(0, Math.min(100_000, Number.parseInt(sp.get("offset") ?? "0", 10) || 0));
  const rs = await getSiteReviews();
  if (!rs) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const list = filterReviews(rs, f);
  return NextResponse.json(
    { items: list.slice(offset, offset + REVIEWS_PAGE_SIZE), total: list.length },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
