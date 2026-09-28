import { NextResponse } from "next/server";
import { getPriceOverrides } from "@/lib/price-overrides";

// Public, read-only — exposes exactly the same discounted prices already shown on
// every storefront page (product_price_overrides.sql has a public-read RLS policy).
// "use client" components that resolve products via getProductBySlug() outside any
// server-rendered page (BundleUpsell, CartCrossSell — see lib/price-overrides.ts)
// fetch this once to stay override-aware without needing prop-drilling from a page.
export async function GET() {
  const overrides = await getPriceOverrides();
  return NextResponse.json(Object.fromEntries(overrides));
}
