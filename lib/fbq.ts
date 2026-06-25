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
