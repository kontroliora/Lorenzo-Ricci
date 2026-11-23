"use client";
import { useEffect, useState } from "react";
import { BLACK_FRIDAY_COUNTDOWN as BF, BLACK_FRIDAY_END_MS, countdownParts } from "@/lib/black-friday-countdown";

// The Black Friday countdown on the product page (owner, 22.11.2026 prompt; added 23.11.2026): under the price ("page") and in the
// sticky add-to-cart bar ("bar"). Light background, dark digits. Same fixed end moment as the top strip (lib/black-friday-countdown.ts):
// it never restarts, and it is gone after the end (client timer + html.bf-off before first paint, app/globals.css .bf-sale).
// Digits are filled after mount; tabular figures keep their width, so nothing jumps (the line has its full height from the start).

const pad = (n: number) => String(n).padStart(2, "0");

export function ProductCountdown({ variant = "page" }: { variant?: "page" | "bar" }) {
  const [left, setLeft] = useState<number | null>(null);
  const [over, setOver] = useState(!BF.enabled);

  useEffect(() => {
    if (!BF.enabled) return;
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
  const v = (n: number | undefined) => (n === undefined ? "--" : pad(n));

  if (variant === "bar") {
    return (
      <p data-testid="bar-countdown" role="timer" className="bf-sale mt-1 font-sans text-[11px] leading-none text-[#B3121F] whitespace-nowrap">
        <span className="font-medium">{BF.label.hero}</span>{" "}
        <span className="tabular-nums font-semibold">{v(t?.d)}д {v(t?.h)}ч {v(t?.m)}м {v(t?.s)}с</span>
      </p>
    );
  }

  const cell = (n: number | undefined, unit: string) => (
    <span className="whitespace-nowrap">
      <span className="tabular-nums font-semibold text-navy text-[15px]">{v(n)}</span>
      <span className="ml-[2px] text-[11px] text-ink-muted">{unit}</span>
    </span>
  );
  return (
    <p data-testid="product-countdown" role="timer"
      className="bf-sale mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-sans text-[12.5px] text-[#B3121F]">
      <span className="whitespace-nowrap font-medium tracking-[0.04em] uppercase text-[11.5px]">Черен петък · {BF.label.salePage.toLowerCase()}</span>
      <span className="flex items-baseline gap-2">
        {cell(t?.d, "д")}{cell(t?.h, "ч")}{cell(t?.m, "м")}{cell(t?.s, "с")}
      </span>
    </p>
  );
}
