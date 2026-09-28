"use client";
import { createContext, useContext, type ReactNode } from "react";

// The store sells to Bulgaria only (Dubai/AED and EN/RO are gone), so the visitor
// country is a constant. The root layout no longer reads the geo header, which
// lets every storefront page be rendered once at build time and served from the
// edge instead of on every request. The provider stays so any later market test
// can override the value for a subtree without touching the consumers.
const CountryContext = createContext<string | null>("BG");

export function CountryProvider({ country, children }: { country: string | null; children: ReactNode }) {
  return <CountryContext.Provider value={country}>{children}</CountryContext.Provider>;
}

export function useCountry(): string | null {
  return useContext(CountryContext);
}
