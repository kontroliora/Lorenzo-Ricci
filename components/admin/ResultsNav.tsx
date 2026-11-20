"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Оборот · Трафик · ROAS are ONE tab in the panel's main nav (owner only) and
 * switch between each other here. Three routes, not one page: each view loads
 * only its own data, so opening the tab stays as fast as it was.
 */
export const RESULTS_VIEWS = [
  { href: "/lr-panel-v8m3q/revenue", label: "Оборот",  hint: "пари от доставени пратки" },
  { href: "/lr-panel-v8m3q/traffic", label: "Трафик",  hint: "посетители и откъде идват" },
  { href: "/lr-panel-v8m3q/roas",    label: "ROAS",    hint: "връщане от рекламата" },
] as const;

/** Every path that belongs to this one tab (the main nav highlights it on all three). */
export const RESULTS_PATHS = RESULTS_VIEWS.map((v) => v.href);

export function ResultsNav() {
  const pathname = usePathname() ?? "";
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
      <div
        role="tablist"
        aria-label="Оборот, трафик и ROAS"
        style={{
          display: "flex", gap: 6, padding: 4, borderRadius: 12,
          background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)",
          overflowX: "auto",
        }}
      >
        {RESULTS_VIEWS.map((v) => {
          const active = pathname.startsWith(v.href);
          return (
            <Link
              key={v.href}
              href={v.href}
              role="tab"
              aria-selected={active}
              style={{
                flex: "1 1 0", minWidth: 96, textAlign: "center", whiteSpace: "nowrap",
                padding: "9px 14px", borderRadius: 9, textDecoration: "none",
                background: active ? "rgba(250,199,117,0.16)" : "transparent",
                border: `0.5px solid ${active ? "rgba(250,199,117,0.5)" : "transparent"}`,
                color: active ? "#FAC775" : "rgba(255,255,255,0.5)",
                fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              {v.label}
              <span style={{ display: "block", fontSize: 10, letterSpacing: 0, textTransform: "none", color: active ? "rgba(250,199,117,0.65)" : "rgba(255,255,255,0.3)" }}>{v.hint}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
