"use client";
import { usePathname } from "next/navigation";

/**
 * Hides the Bulgarian storefront chrome (header, footer, cart, popups) on the
 * protected admin panel routes so it never shows over the admin views, and on the
 * Romanian market test (/ro/...), which brings its own Romanian chrome (app/ro/layout.tsx).
 */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && (pathname.startsWith("/lr-panel") || pathname === "/ro" || pathname.startsWith("/ro/"))) return null;
  return <>{children}</>;
}
