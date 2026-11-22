"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BLACK_FRIDAY_COUNTDOWN as BF,
  BLACK_FRIDAY_END_MS,
  BLACK_FRIDAY_LAST_DAY_MS,
  BLACK_FRIDAY_LAST_HOURS_MS,
} from "@/lib/black-friday-countdown";

// Fixed strip right under the AnnouncementBar (top-9), the whole strip links to /namalenia. Its height is --bf-h
// (app/globals.css), which also moves the Header down and is reserved in the page flow by the spacer below, so no page offset
// (pt-[116px] etc.) had to change.
// All phase labels are rendered and CSS shows the right one from html.bf-day / html.bf-hours (set before first paint by the
// inline script in app/layout.tsx and kept up to date here), so a static page never flashes the wrong text or colour.
// The digits are filled after mount (the pages are static, so the server can't know the time); their width is reserved with
// tabular figures, so nothing jumps. No library, no network request.

const pad = (n: number) => String(n).padStart(2, "0");

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Cell({ v, unit, pulse }: { v: number | undefined; unit: string; pulse?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span
        // A fresh key every second restarts the soft fade-in on the seconds (no blinking, off with reduced motion).
        key={pulse ? v : undefined}
        className={`inline-block tabular-nums font-bold text-white text-[13px] sm:text-[14px] tracking-[0.02em] ${pulse && v !== undefined ? "bf-pulse" : ""}`}
      >
        {v === undefined ? "--" : pad(v)}
      </span>
      <span className="ml-[1px] text-[9px] sm:text-[10px] font-normal text-white/55">{unit}</span>
    </span>
  );
}

export function BlackFridayBar() {
  const [left, setLeft] = useState<number | null>(null);
  // Starts "running" on both server and client (no hydration mismatch); the first tick hides it if the end has passed.
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (over) return;
    const tick = () => {
      const now = Date.now();
      const ms = BLACK_FRIDAY_END_MS - now;
      const c = document.documentElement.classList;
      if (ms <= 0) {
        c.add("bf-off");
        setOver(true);
        return;
      }
      c.toggle("bf-hours", now >= BLACK_FRIDAY_LAST_HOURS_MS);
      c.toggle("bf-day", now >= BLACK_FRIDAY_LAST_DAY_MS && now < BLACK_FRIDAY_LAST_HOURS_MS);
      setLeft(ms);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [over]);

  if (over) return null;
  const t = left === null ? null : parts(left);

  return (
    <>
      <Link
        id="bf-bar"
        href={BF.href}
        data-testid="bf-countdown"
        className="fixed top-9 left-0 right-0 z-[51] flex items-center justify-center gap-2.5 sm:gap-4 bg-black px-3 font-sans text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.18em] text-white whitespace-nowrap overflow-hidden transition-colors duration-500"
        style={{ height: "var(--bf-h)" }}
      >
        <span className="font-medium text-gold">
          <span className="hidden sm:inline">
            <span className="bf-l-normal">{BF.label.normal}</span>
            <span className="bf-l-day">{BF.label.lastDay}</span>
            <span className="bf-l-hours">{BF.label.lastHours}</span>
          </span>
          <span className="sm:hidden">{BF.label.short}</span>
        </span>
        <span role="timer" aria-live="off" className="flex items-baseline gap-1.5 sm:gap-2.5">
          <Cell v={t?.d} unit="д" />
          <Cell v={t?.h} unit="ч" />
          <Cell v={t?.m} unit="м" />
          <Cell v={t?.s} unit="с" pulse />
        </span>
      </Link>
      <div aria-hidden className="bf-spacer" style={{ height: "var(--bf-h)" }} />
    </>
  );
}
