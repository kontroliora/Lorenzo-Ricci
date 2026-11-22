"use client";
import { useEffect, useState } from "react";
import { BLACK_FRIDAY_COUNTDOWN, BLACK_FRIDAY_END_MS } from "@/lib/black-friday-countdown";

// Fixed strip right under the AnnouncementBar (top-9). Its height is --bf-h (app/globals.css), which also moves the Header down
// and is reserved in the page flow by the spacer below, so no page offset (pt-[116px] etc.) had to change.
// The digits are filled after mount (the pages are static, so the server can't know the time); their width is reserved with
// tabular figures, so nothing jumps. No library, no network request.

const pad = (n: number) => String(n).padStart(2, "0");

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function BlackFridayBar() {
  const [left, setLeft] = useState<number | null>(null);
  // Starts "running" on both server and client (no hydration mismatch); the first tick hides it if the end has passed.
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (over) return;
    const tick = () => {
      const ms = BLACK_FRIDAY_END_MS - Date.now();
      if (ms <= 0) {
        document.documentElement.classList.add("bf-off");
        setOver(true);
      } else setLeft(ms);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [over]);

  if (over) return null;
  const t = left === null ? null : parts(left);
  const cell = (v: number | undefined, unit: string) => (
    <span className="whitespace-nowrap">
      <span className="tabular-nums font-semibold text-white">{v === undefined ? "--" : pad(v)}</span>
      <span className="text-white/60">{unit}</span>
    </span>
  );

  return (
    <>
      <div
        id="bf-bar"
        data-testid="bf-countdown"
        role="timer"
        aria-label={BLACK_FRIDAY_COUNTDOWN.label}
        className="fixed top-9 left-0 right-0 z-[51] flex items-center justify-center gap-2 sm:gap-4 bg-black px-3 font-sans text-[10px] sm:text-[11px] uppercase tracking-[0.08em] sm:tracking-[0.18em] text-white overflow-hidden"
        style={{ height: "var(--bf-h)" }}
      >
        <span className="font-medium text-gold whitespace-nowrap">{BLACK_FRIDAY_COUNTDOWN.label}</span>
        <span className="flex items-center gap-1.5 sm:gap-2.5">
          {cell(t?.d, "д")}
          {cell(t?.h, "ч")}
          {cell(t?.m, "м")}
          {cell(t?.s, "с")}
        </span>
      </div>
      <div aria-hidden className="bf-spacer" style={{ height: "var(--bf-h)" }} />
    </>
  );
}
