"use client";
import { useState, useEffect } from "react";

const DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const KEY = "lr_summer_promo_start";

function getTimeLeft() {
  let start = parseInt(localStorage.getItem(KEY) ?? "0", 10);
  const now = Date.now();
  if (!start || now - start >= DURATION_MS) {
    start = now;
    localStorage.setItem(KEY, String(start));
  }
  const rem = DURATION_MS - (now - start);
  return {
    days:    Math.floor(rem / 86400000),
    hours:   Math.floor(rem / 3600000) % 24,
    minutes: Math.floor(rem / 60000) % 60,
    seconds: Math.floor(rem / 1000) % 60,
  };
}

export function SummerCountdown() {
  const [time, setTime] = useState<ReturnType<typeof getTimeLeft> | null>(null);

  useEffect(() => {
    setTime(getTimeLeft());
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const units = [
    { val: time.days,    label: "дни"  },
    { val: time.hours,   label: "часа" },
    { val: time.minutes, label: "мин"  },
    { val: time.seconds, label: "сек"  },
  ] as const;

  return (
    <div className="border border-navy/20 bg-navy/[0.03] px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-navy text-xs">◈</span>
          <p className="font-sans text-[9px] font-semibold tracking-[0.3em] uppercase text-navy">
            Лятна промоция
          </p>
        </div>
        <p className="font-sans text-[11px] font-light text-ink-muted tracking-wide leading-snug">
          Намалението приключва след:
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {units.map(({ val, label }, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center w-8">
              <span className="font-serif text-[22px] text-charcoal leading-none tabular-nums">
                {pad(val)}
              </span>
              <span className="font-sans text-[8px] tracking-[0.15em] uppercase text-ink-faint mt-0.5">
                {label}
              </span>
            </div>
            {i < 3 && (
              <span className="text-navy/30 font-serif text-lg leading-none mb-3.5">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
