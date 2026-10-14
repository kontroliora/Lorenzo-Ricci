"use client";

// Called by the "payment cancelled" pages: tells the server to close the Stripe session and put the reserved stock
// back at once (signed link, see lib/payment-token.ts). Once per order per browser tab. Failures are harmless: the
// Stripe webhook and the daily sweep release the order later anyway.
export function releasePendingOrder(ref: string | null, ct: string | null): void {
  if (!ref || !ct) return;
  const key = `lr_release_${ref}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
  void fetch("/api/order-payment/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, ct }), keepalive: true }).catch(() => {});
}
