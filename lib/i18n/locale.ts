import { cookies } from "next/headers";
import { resolveCountry } from "@/lib/geo";
import { LOCALE_COOKIE, isLocale, localeForCountry, type Locale } from "./config";

// SERVER-ONLY (pulls in next/headers). Client components must import constants
// from ./config instead.
export * from "./config";

// Priority: explicit choice (cookie) > geo default > bg.
// A Bulgarian who switches to English keeps English; their COUNTRY stays BG, which
// is what drives pricing and the newsletter popup — language and market are separate.
export async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeForCountry(await resolveCountry());
}
