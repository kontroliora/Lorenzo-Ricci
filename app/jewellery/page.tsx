import type { Metadata } from "next";
import { Suspense } from "react";
import { getBracelets, getNecklaces } from "@/lib/products";
import { getPriceOverrides, applyOverrides } from "@/lib/price-overrides";
import { getSoldOutSlugs } from "@/lib/sold-out";
import { soldOutLast } from "@/lib/sold-out-order";
import { JewelleryPageClient } from "./JewelleryPageClient";

export const metadata: Metadata = {
  title: "Бижута",
  description:
    "Lorenzo Ricci бижута - гривни и колиета с 4-слойно 18K PVD позлата. Хипоалергенни, устойчиви на вода. Доживотна гаранция.",
};

// JewelleryPageClient is "use client" and used to call getBracelets()/getNecklaces()
// itself in the browser bundle, which can't see server-fetched overrides. Fetching
// and merging here, then passing the lists down as props, keeps the merge point
// server-side without changing what the client component renders.
//
// Durable price overrides (supabase/product_price_overrides.sql, read via
// lib/price-overrides.ts) — page stays statically generated; the admin discount
// route calls revalidatePath("/jewellery") on every write.

// Sold-out products are listed last (lib/sold-out-order.ts); the sold-out list is re-read every 5 minutes.
export const revalidate = 300;

export default async function JewelleryPage() {
  const overrides = await getPriceOverrides();
  const soldOut = new Set(await getSoldOutSlugs());
  const bracelets = soldOutLast(applyOverrides(getBracelets(), overrides), (s) => soldOut.has(s));
  const necklaces = soldOutLast(applyOverrides(getNecklaces(), overrides), (s) => soldOut.has(s));

  return (
    <Suspense>
      <JewelleryPageClient bracelets={bracelets} necklaces={necklaces} />
    </Suspense>
  );
}
