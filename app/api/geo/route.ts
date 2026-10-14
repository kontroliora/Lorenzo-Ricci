import { NextRequest, NextResponse } from "next/server";
import { countryOf } from "@/lib/geo-redirect";

export const dynamic = "force-dynamic";

// What the first-visit redirect sees for YOUR request: GET https://www.lorenzo-ricci.com/api/geo
// `country` is the one the redirect would use (Cloudflare's CF-IPCountry first, then Vercel's); `cf` empty on production
// means Cloudflare's IP geolocation header is not reaching the site (the redirect would then fall back to Vercel's header,
// which behind Cloudflare names Cloudflare's edge, not the visitor). Returns only the caller's own country code.
export function GET(req: NextRequest) {
  const h = req.headers;
  const cf = h.get("cf-ipcountry");
  const vercel = h.get("x-vercel-ip-country");
  return NextResponse.json(
    { country: countryOf({ cfCountry: cf, vercelCountry: vercel }), cf, vercel, language: h.get("accept-language")?.split(",")[0] ?? null, lrLang: req.cookies.get("lr_lang")?.value ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
