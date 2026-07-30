import { headers, cookies } from "next/headers";

// Server-only: resolves the visitor country (ISO-2) that drives geo display like
// AED pricing. Real source is Vercel's x-vercel-ip-country edge header.
//
// TEST OVERRIDE: an `x_geo` cookie wins when present — set it in devtools
// (`document.cookie = "x_geo=AE"`) to preview the UAE experience without a VPN.
// Real visitors never carry it. Display-only (checkout is EUR/soft-declined), so
// forcing it has no financial effect — but remove/gate this after the test.
export async function resolveCountry(): Promise<string | null> {
  const override = (await cookies()).get("x_geo")?.value;
  if (override) return override.trim().toUpperCase();
  return (await headers()).get("x-vercel-ip-country");
}
