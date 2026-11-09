"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// One beacon per page (incl. in-app navigations) to /api/pv -> page_views, for the panel's ТРАФИК tab.
// - Production hosts only (same rule as the Meta pixel), never on the admin panel.
// - Waits for the pixel's human gate (window.lrWhenHuman: a scroll, tap, click, key, mouse movement or 6 s on the tab), so the
//   numbers are people, not Meta's ad-review scrapers. Without the gate (pixel blocked) it sends at once.
// - Visitor = a random id in localStorage; session = a random id in sessionStorage. No cookie, no personal data.
// - The external referrer and utm_* / fbclid are read from the session's landing page.
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
function stored(store: Storage | undefined, key: string): string {
  try {
    let v = store?.getItem(key);
    if (!v) { v = rid(); store?.setItem(key, v); }
    return v;
  } catch { return rid(); }
}

export function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/lr-panel") || pathname.startsWith("/partner") || pathname.startsWith("/api/")) return;
    if (!/(^|\.)lorenzo-ricci\.com$/.test(location.hostname)) return;
    const isLanding = first.current;
    first.current = false;
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({
      vid: stored(typeof localStorage === "undefined" ? undefined : localStorage, "lr_vid"),
      sid: stored(typeof sessionStorage === "undefined" ? undefined : sessionStorage, "lr_sid"),
      path: pathname,
      ref: isLanding ? document.referrer : "",
      us: q.get("utm_source") ?? undefined,
      um: q.get("utm_medium") ?? undefined,
      uc: q.get("utm_campaign") ?? undefined,
      ut: q.get("utm_content") ?? undefined,
      fb: q.has("fbclid"),
    });
    const send = () => {
      try {
        if (navigator.sendBeacon?.("/api/pv", new Blob([body], { type: "application/json" }))) return;
        fetch("/api/pv", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      } catch { /* never in the way */ }
    };
    const gate = (window as unknown as { lrWhenHuman?: (fn: () => void) => void }).lrWhenHuman;
    if (gate) gate(send); else send();
  }, [pathname]);

  return null;
}
