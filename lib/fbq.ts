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

export function trackFbEvent(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params, eventId ? { eventID: eventId } : undefined);
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
      currency:   params.currency,
      contentIds: params.content_ids,
      numItems:   params.num_items,
    }),
  }).catch(() => {});
}
