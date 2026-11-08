// Romanian store on / off (owner, 09.11.2026: switched off for now; no code is deleted).
// Off: every /ro/* page answers 302 with its Bulgarian twin (lib/ro/route-map.ts), the RO card-payment return pages excepted
// (a payment already under way still gets its confirmation), the first-visit geo redirect to /ro stops, the BG · RO switch is
// hidden, /api/order-ro refuses new orders and the health checks / synthetic shopper skip RO. Existing RO orders stay in the panel.
// On again: set NEXT_PUBLIC_RO_STORE_ENABLED=true in Vercel (or change the default below) and redeploy.
// Pure and edge-safe: read by middleware.ts, server routes and client components alike.
export const RO_STORE_ENABLED: boolean = process.env.NEXT_PUBLIC_RO_STORE_ENABLED === "true";

/** RO paths that stay reachable while the store is off: Stripe sends paying customers back there. */
export const RO_ALWAYS_OPEN = (pathname: string): boolean => pathname.startsWith("/ro/comanda/");
