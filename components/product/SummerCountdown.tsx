"use client";
import { useState, useEffect } from "react";

const DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = "lr_summer_promo";

function readStart(): number {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return m ? parseInt(decodeURIComponent(m[1]), 10) : 0;
}

function writeStart(start: number) {
  const exp = new Date(start + 8 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE}=${start}; expires=${exp}; path=/; SameSite=Lax`;
}

function getTimeLeft() {
  let start = readStart();
  const now = Date.now();
  if (!start || now - start >= DURATION_MS) {
    start = now;
    writeStart(start);
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
    <div className="border border-navy/20 bg-navy/[0.03] px-5 py-4 flex items-center gap-5">
      {/* Promo text */}
      <div className="flex-1 min-w-0">
        <p className="section-tag mb-1">Лятна разпродажба</p>
        <p className="font-sans text-[11px] font-light text-ink-soft tracking-wide leading-snug">
          Спестете €104 · Безплатна доставка в България
        </p>
      </div>

      {/* Vertical divider */}
      <div className="w-px h-9 bg-border flex-shrink-0" />

      {/* Countdown */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {units.map(({ val, label }, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center w-8">
              <span className="font-serif text-[22px] text-charcoal leading-none tabular-nums">
                {pad(val)}
              </span>
              <span className="font-sans text-[8px] tracking-[0.12em] uppercase text-ink-faint mt-0.5">
                {label}
              </span>
            </div>
            {i < 3 && (
              <span className="text-navy/30 font-serif text-base leading-none mb-3">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
