declare global {
  interface Window {
    fbq: (
      method: "init" | "track" | "trackCustom",
      event: string,
      params?: Record<string, unknown>,
      eventData?: { eventID?: string }
    ) => void;
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
  window.fbq("track", event, withIsoCurrency(params), eventId ? { eventID: eventId } : undefined);
}

/** Generate a unique event ID for deduplication between browser pixel and CAPI. */
export function genEventId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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

  // Server-side CAPI — best-effort, never throws
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
    }),
  }).catch(() => {});
}
