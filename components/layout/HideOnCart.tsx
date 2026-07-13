"use client";
import { useCartStore } from "@/lib/store";

// Hide marketing surfaces (newsletter popup, sales toast) while the cart drawer
// is open — same idea as HideOnTrack, but state-driven. A popup over an open
// cart/checkout is friction (it looked bad landing on the recovery flow too).
// When the cart closes the children remount and resume their normal logic.
export function HideOnCart({ children }: { children: React.ReactNode }) {
  const cartOpen = useCartStore((s) => s.isOpen);
  if (cartOpen) return null;
  return <>{children}</>;
}
