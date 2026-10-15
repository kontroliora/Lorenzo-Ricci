// Checkout failures seen from the browser, sent to /api/checkout-event so staff can see where customers get stuck
// (the order request itself never leaves the browser when the form stops it, so the server would otherwise know nothing).
// ONLY field names and our own generic codes are sent: never what the customer typed.
export type CheckoutFailure = {
  market: "bg" | "ro";
  kind: "validation" | "server" | "network";
  fields?: string[];      // the form fields that stopped the submit (validation): name, phone, email, city, officeAddress ...
  code?: string;          // the server's error code (server): price_mismatch, stock, bad_customer ...
  status?: number;        // HTTP status (server)
  delivery?: string;      // office | office-manual | home
  picker?: string;        // BG: the Econt list state: ready | loading | failed
  sessionId?: string;     // the saved cart of this visit (links to cart_sessions in the panel)
};

export function logCheckoutFailure(f: CheckoutFailure): void {
  try {
    const body = JSON.stringify({ ...f, w: typeof window !== "undefined" ? window.innerWidth : 0 });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon("/api/checkout-event", new Blob([body], { type: "application/json" }))) return;
    }
    fetch("/api/checkout-event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* logging must never get in the customer's way */ }
}
