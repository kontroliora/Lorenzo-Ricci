import { NextResponse } from "next/server";
import { getPriceOverrides } from "@/lib/price-overrides";

// Public, read-only — exposes exactly the same discounted prices already shown on
// every storefront page (product_price_overrides.sql has a public-read RLS policy).
// "use client" components that resolve products via getProductBySlug() outside any
// server-rendered page (BundleUpsell, CartCrossSell — see lib/price-overrides.ts)
// fetch this once to stay override-aware without needing prop-drilling from a page.
// Built statically like the pages (ISR): served from Vercel's cache without running a function, and rebuilt at once by
// the admin discount route (PRICE_OVERRIDES_TAG + revalidatePath below), so a new price is here as soon as it is saved.
// The hour is only a safety net. Checkout never reads this: the order routes price every line on the server.
export const revalidate = 3600;

export async function GET() {
  const overrides = await getPriceOverrides();
  return NextResponse.json(Object.fromEntries(overrides));
}
