declare global {
  interface Window {
    fbq: (
      method: "init" | "track" | "trackCustom",
      event: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

export function trackFbEvent(
  event: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}
