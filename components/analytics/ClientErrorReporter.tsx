"use client";
import { useEffect } from "react";
import { useCartStore } from "@/lib/store";
import { useRoCart } from "@/lib/ro/store";

// Browser JS errors + unhandled promise rejections -> /api/client-error (table client_errors) -> health alert (lib/health.ts).
// Whole site, BG and /ro (root layout). Kept cheap and private:
//   - the same error is reported at most once per browser per 10 minutes (localStorage), at most 5 reports per page load;
//   - noise is dropped here: browser extensions, other sites' scripts (pixel, in-app browsers), "Script error.", network
//     hiccups (checkout network failures are already logged by /api/checkout-event), bots;
//   - no personal data: the message is scrubbed (e-mails, long numbers, query strings), the page is the path only.
const REPEAT_MS = 10 * 60_000;
const MAX_PER_LOAD = 5;
const LS_KEY = "lr_cerr";
const NOISE = /ResizeObserver loop|Script error\.?$|Non-Error promise rejection|Failed to fetch|Load failed|NetworkError|network error|AbortError|aborted|cancell?ed|The operation was aborted|Importing a module script failed|fbq|_AutofillCallbackHandler|instantSearchSDKJSBridgeClearHighlight|webkit\.messageHandlers/i;

const scrub = (s: string) =>
  s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>").replace(/\?[^\s"')]*/g, "").replace(/\d{5,}/g, "<n>").slice(0, 300);

function sameOrigin(file: string | undefined): boolean {
  if (!file) return true;   // inline / unknown: keep
  try { return new URL(file, location.href).origin === location.origin; } catch { return false; }
}

export function ClientErrorReporter() {
  useEffect(() => {
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
    let sent = 0;

    const area = (): "checkout" | "cart" | "page" => {
      const p = location.pathname;
      if (/^\/(poruchka|ro\/comanda)(\/|$)/.test(p)) return "checkout";
      try { if (p.startsWith("/ro") ? useRoCart.getState().isOpen : useCartStore.getState().isOpen) return "cart"; } catch { /* store not ready */ }
      return "page";
    };

    const report = (kind: "error" | "rejection", raw: string, file?: string, line?: number, col?: number) => {
      try {
        if (sent >= MAX_PER_LOAD || location.pathname.startsWith("/lr-panel-")) return;
        const message = scrub(String(raw || "").trim());
        if (!message || NOISE.test(message) || !sameOrigin(file)) return;
        const source = file ? `${new URL(file, location.href).pathname.split("/").pop()}:${line ?? 0}:${col ?? 0}`.slice(0, 120) : "";
        const key = `${kind}|${message.slice(0, 120)}|${source.split(":")[0]}`;
        let seen: Record<string, number> = {};
        try { seen = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { /* private mode */ }
        const now = Date.now();
        if (seen[key] && now - seen[key] < REPEAT_MS) return;
        for (const k of Object.keys(seen)) if (now - seen[k] > REPEAT_MS) delete seen[k];
        seen[key] = now;
        try { localStorage.setItem(LS_KEY, JSON.stringify(seen)); } catch { /* private mode */ }
        sent++;
        const body = JSON.stringify({ kind, message, source, page: location.pathname.slice(0, 120), area: area(), market: location.pathname.startsWith("/ro") ? "ro" : "bg" });
        const blob = new Blob([body], { type: "application/json" });
        if (!navigator.sendBeacon?.("/api/client-error", blob)) fetch("/api/client-error", { method: "POST", body, keepalive: true }).catch(() => {});
      } catch { /* never let the reporter itself throw */ }
    };

    const onError = (e: ErrorEvent) => report("error", e.message || (e.error instanceof Error ? e.error.message : ""), e.filename, e.lineno, e.colno);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? `${r.name}: ${r.message}` : typeof r === "string" ? r : "";
      const stackFile = r instanceof Error ? (r.stack ?? "").match(/(https?:\/\/[^\s)]+?):(\d+):(\d+)/) : null;
      report("rejection", msg, stackFile?.[1], stackFile ? +stackFile[2] : undefined, stackFile ? +stackFile[3] : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
