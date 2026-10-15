import { NextResponse } from "next/server";
import { getOfficeList } from "@/lib/econt-offices";

export const runtime = "nodejs";
export const maxDuration = 30; // a cold fetch from Econt takes 1-2 s (compressed); the limit only protects against a slow day

// The checkout's office / automat picker reads this slim copy of Econt's official list (lib/econt-offices.ts: refreshed once a day).
// If Econt cannot be reached and nothing was loaded yet the answer is 502 and the checkout falls back to the manual field.
export async function GET() {
  const list = await getOfficeList();
  if (!list) return NextResponse.json({ ok: false }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(list, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
}
