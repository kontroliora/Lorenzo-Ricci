"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { translate, type DictKey } from "./dict";

// Active display language, resolved server-side in the root layout and passed down.
// Separate from the visitor's COUNTRY (lib/country.tsx) — a Bulgarian may read the
// site in English while still being a BG customer with BG pricing and delivery.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

// t("nav.watches") → "Ceasuri". Key set is compile-checked against the dictionary.
export function useT(): (key: DictKey) => string {
  const locale = useLocale();
  return useCallback((key: DictKey) => translate(locale, key), [locale]);
}

// Persist an explicit language choice (beats geo on the next request) and reload so
// the server re-renders the tree in that language. One year, site-wide.
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}
