"use client";
import { usePathname } from "next/navigation";

/**
 * Hides the public storefront chrome (header, footer, cart, popups) on the
 * protected admin panel routes so it never shows over the admin views.
 */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && pathname.startsWith("/lr-panel")) return null;
  return <>{children}</>;
}
