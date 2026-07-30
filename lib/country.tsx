"use client";
import { createContext, useContext, type ReactNode } from "react";

// Detected visitor country (ISO-2, e.g. "AE"/"BG"), sourced server-side from the
// x-vercel-ip-country header in the root layout and provided to client components.
// Drives geo display like AED pricing — NOT the same as the chosen display locale.
// null when unknown (local dev, or the header is absent).
const CountryContext = createContext<string | null>(null);

export function CountryProvider({ country, children }: { country: string | null; children: ReactNode }) {
  return <CountryContext.Provider value={country}>{children}</CountryContext.Provider>;
}

export function useCountry(): string | null {
  return useContext(CountryContext);
}
