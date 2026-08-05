// Pure locale constants/types — NO server-only deps, so client components can
// import this freely (unlike ./locale.ts, which pulls in next/headers and can only
// be used server-side). Same split as lib/order-status.ts vs lib/orders.ts.

export const LOCALES = ["bg", "en", "ro"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "bg";
export const LOCALE_COOKIE = "lr_lang";

// <html lang> value per locale.
export const HTML_LANG: Record<Locale, string> = { bg: "bg", en: "en", ro: "ro" };

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

// Country → default language. Anything not listed falls back to English, so a
// visitor from any other market gets a language they can read (not Bulgarian).
export function localeForCountry(country: string | null): Locale {
  if (!country) return DEFAULT_LOCALE; // unknown (local dev / no edge header) → BG
  if (country === "BG") return "bg";
  if (country === "RO") return "ro";
  return "en";
}
