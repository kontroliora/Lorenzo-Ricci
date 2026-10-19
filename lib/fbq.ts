import { CALLING_CODE, isSha256Hex, normalizeEmail, normalizePhone, sha256Hex, type Market } from "@/lib/match-keys";

declare global {
  interface Window {
    fbq: (
      method: "init" | "track" | "trackCustom",
      event: string,
      params?: Record<string, unknown>,
      eventData?: { eventID?: string }
    ) => void;
    // Installed by components/analytics/MetaPixel.tsx: runs fn now if a person has shown up on
    // the page, else once one does (bots that open a page and leave never trigger it).
    lrWhenHuman?: (fn: () => void) => void;
  }
}

// Meta only accepts ISO 4217 currency codes; the catalog's `currency` is the display
// symbol ("€"). Every event goes through here, so a slip at a call site can't reach
// Meta as "€" (which makes Meta drop the value).
function withIsoCurrency(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params || !("currency" in params) && !("value" in params)) return params;
  const c = params.currency;
  return { ...params, currency: typeof c === "string" && /^[A-Z]{3}$/.test(c) ? c : "EUR" };
}

export function trackFbEvent(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  const send = () => window.fbq("track", event, withIsoCurrency(params), eventId ? { eventID: eventId } : undefined);
  // ViewContent is a landing-page signal like PageView, and ad landing pages are product pages:
  // hold it back until a person shows up (the other events need a real action anyway).
  if (event === "ViewContent" && window.lrWhenHuman) window.lrWhenHuman(send);
  else send();
}

/** Generate a unique event ID for deduplication between browser pixel and CAPI. */
export function genEventId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Matching keys for the Conversions API ───────────────────────────────────────────────────────────────────────────────
// lr_xid: a random id of THIS browser (first-party cookie, 1 year). The server hashes it and sends it as external_id, so the
// server events (AddToCart, InitiateCheckout, Purchase) of one visitor are tied together. It identifies no person.
const XID = "lr_xid";
const MATCH_KEYS = "lr_mk"; // { em, ph }: SHA-256 hashes only, never the plain e-mail / phone

export function ensureExternalId(): string | undefined {
  try {
    const fromCookie = document.cookie.split("; ").find((c) => c.startsWith(`${XID}=`))?.slice(XID.length + 1);
    let id = fromCookie;
    if (!id) { try { id = localStorage.getItem(XID) ?? undefined; } catch { /* no storage */ } }
    if (!id) id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    document.cookie = `${XID}=${id}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    try { localStorage.setItem(XID, id); } catch { /* no storage */ }
    return id;
  } catch { return undefined; }
}

/**
 * Remember the hashed e-mail / phone a visitor typed (checkout form, newsletter), so later events can carry them.
 * Normalised first (phone with the country code: 0888... -> 359888...), hashed in the browser, plain values are not stored.
 */
export async function rememberMatchKeys(who: { email?: string; phone?: string }, market: Market): Promise<void> {
  try {
    const em = normalizeEmail(who.email);
    const ph = normalizePhone(who.phone, market);
    const phoneOk = ph !== undefined && ph.startsWith(CALLING_CODE[market]) && ph.length === CALLING_CODE[market].length + 9; // a whole mobile number, not a half-typed one
    if (!em && !phoneOk) return;
    let cur: { em?: string; ph?: string } = {};
    try { cur = JSON.parse(localStorage.getItem(MATCH_KEYS) || "{}") ?? {}; } catch { /* start fresh */ }
    if (em) cur.em = await sha256Hex(em);
    if (phoneOk) cur.ph = await sha256Hex(ph as string);
    try { localStorage.setItem(MATCH_KEYS, JSON.stringify(cur)); } catch { /* no storage */ }
  } catch { /* matching is best effort */ }
}

function knownMatchKeys(): { em?: string; ph?: string } {
  try {
    const cur = JSON.parse(localStorage.getItem(MATCH_KEYS) || "{}") ?? {};
    return { ...(isSha256Hex(cur.em) ? { em: cur.em } : {}), ...(isSha256Hex(cur.ph) ? { ph: cur.ph } : {}) };
  } catch { return {}; }
}

/**
 * Fire browser pixel AND server-side CAPI in parallel (fire-and-forget for CAPI).
 * Uses the same eventId so Meta deduplicates automatically.
 */
export function trackWithCapi(
  eventName: "AddToCart" | "InitiateCheckout",
  params: Record<string, unknown>,
  eventId: string
): void {
  trackFbEvent(eventName, params, eventId);

  // Server-side CAPI — best-effort, never throws. The cookie lr_xid (external_id) travels with the request.
  ensureExternalId();
  fetch("/api/capi", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      eventId,
      value:      params.value,
      currency:   withIsoCurrency(params)?.currency ?? "EUR",
      contentIds: params.content_ids,
      numItems:   params.num_items,
      url:        window.location.href, // the page the event happened on (event_source_url)
      ...knownMatchKeys(),              // em / ph hashes, only when the visitor typed them earlier in this browser
    }),
  }).catch(() => {});
}
