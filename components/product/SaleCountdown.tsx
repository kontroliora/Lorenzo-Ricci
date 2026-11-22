"use client";
import { useEffect, useState } from "react";
import { BLACK_FRIDAY_COUNTDOWN as BF, BLACK_FRIDAY_END_MS, countdownParts } from "@/lib/black-friday-countdown";

// "Офертите изтичат след 07д 06ч 15м 28с" in the /namalenia hero (owner, 22.11.2026). Same fixed end moment as the top strip
// (lib/black-friday-countdown.ts). Gone after the end: the client timer removes it, and html.bf-off (the pre-paint check in
// app/layout.tsx) hides it before first paint on a page built earlier (app/globals.css .bf-sale).
// Digits are filled after mount (static page); tabular figures keep their width, so nothing jumps.

const pad = (n: number) => String(n).padStart(2, "0");

export function SaleCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!BF.enabled) return setOver(true);
    const tick = () => {
      const ms = BLACK_FRIDAY_END_MS - Date.now();
      if (ms <= 0) setOver(true);
      else setLeft(ms);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (over) return null;
  const t = left === null ? null : countdownParts(left);
  const cell = (v: number | undefined, unit: string) => (
    <span className="whitespace-nowrap">
      <span className="tabular-nums font-semibold text-white text-[17px] sm:text-[20px] tracking-[0.02em]">{v === undefined ? "--" : pad(v)}</span>
      <span className="ml-[2px] text-[11px] sm:text-xs text-white/65">{unit}</span>
    </span>
  );

  return (
    <p
      data-testid="sale-countdown"
      role="timer"
      className="bf-sale mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 font-sans text-[13px] sm:text-sm font-light text-white/80"
    >
      <span className="whitespace-nowrap">{BF.label.salePage}</span>
      <span className="flex items-baseline gap-2 sm:gap-2.5">
        {cell(t?.d, "д")}
        {cell(t?.h, "ч")}
        {cell(t?.m, "м")}
        {cell(t?.s, "с")}
      </span>
    </p>
  );
}
