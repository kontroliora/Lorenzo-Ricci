"use client";
import { usePathname } from "next/navigation";

/**
 * Hides marketing popups (the newsletter/discount modal and the social-proof
 * "someone just bought" toast) on the shipment tracking pages /track/* and on
 * the card-payment return pages /poruchka/*. A customer following an existing
 * parcel, or looking at the confirmation of a payment, shouldn't be offered a
 * new-customer discount. Everywhere else the popups render exactly as before.
 */
export function HideOnTrack({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/track" || pathname?.startsWith("/track/") || pathname === "/poruchka" || pathname?.startsWith("/poruchka/")) return null;
  return <>{children}</>;
}
