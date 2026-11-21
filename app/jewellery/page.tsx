import type { Metadata } from "next";
import { Suspense } from "react";
import { getBracelets, getNecklaces } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { soldOutLast } from "@/lib/sold-out-order";
import { JewelleryPageClient, JewelleryPageView } from "./JewelleryPageClient";
import { getApprovedReviewCounts } from "@/lib/user-reviews-server";
import { isCollectionSlug } from "@/lib/new-collection";
import { displayRating, displayReviewCount } from "@/lib/user-reviews";

export const metadata: Metadata = {
  title: "Дамска колекция бижута",
  description:
    "Lorenzo Ricci дамска колекция - гривни и колиета с 4-слойно 18K PVD позлата. Хипоалергенни, устойчиви на вода. Доживотна гаранция.",
};

// JewelleryPageClient is "use client" and used to call getBracelets()/getNecklaces()
// itself in the browser bundle, which can't see server-fetched overrides. Fetching
// and merging here, then passing the lists down as props, keeps the merge point
// server-side without changing what the client component renders.
//
// Durable price overrides (supabase/product_price_overrides.sql, read via
// lib/price-overrides.ts) — page stays statically generated; the admin discount
// route calls revalidatePath("/jewellery") on every write.

// Sold-out products are listed last (lib/sold-out-order.ts). Rebuilt hourly; a sell-out (lib/stock-pages.ts), a price
// change (admin discount route) and a campaign phase switch (/api/cron/campaign-phase) rebuild it at once.
export const revalidate = 3600;

export default async function JewelleryPage() {
  const overrides = await getPriceOverrides();
  const soldOut = new Set(await getSoldOutSlugs());
  const bracelets = soldOutLast(applyOverrides(getBracelets(), overrides), (s) => soldOut.has(s));
  const necklaces = soldOutLast(applyOverrides(getNecklaces(), overrides), (s) => soldOut.has(s));
  const collectionSlugs = [...bracelets, ...necklaces].filter((p) => isCollectionSlug(p.slug)).map((p) => p.slug);
  const realReviewCounts = await getApprovedReviewCounts(collectionSlugs);
  // Card badge here mirrors the product page's own title badge, not the real count/average (owner, 21.11.2026): without
  // this every card showed the same real average, which rounds to "4.8" for every piece - see lib/user-reviews.ts.
  const reviewCounts: Record<string, { count: number; avg: number }> = {};
  for (const slug of collectionSlugs) {
    const r = realReviewCounts[slug];
    if (r) reviewCounts[slug] = { count: displayReviewCount(slug, r.count), avg: displayRating(slug) };
  }

  return (
    <Suspense fallback={<JewelleryPageView bracelets={bracelets} necklaces={necklaces} reviewCounts={reviewCounts} category={null} />}>
      <JewelleryPageClient bracelets={bracelets} necklaces={necklaces} reviewCounts={reviewCounts} />
    </Suspense>
  );
}
