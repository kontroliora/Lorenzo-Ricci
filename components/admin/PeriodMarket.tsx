"use client";
// Shared "Днес / 7 дни / 30 дни" + "Всички / BG / RO" switch for the ТРАФИК tab and the ads block of ROAS.
export type P = "today" | "7d" | "30d";
export type M = "all" | "bg" | "ro";

export function PeriodMarket({ period, market, onChange, busy, right }: {
  period: P; market: M; onChange: (p: P, m: M) => void; busy?: boolean; right?: React.ReactNode;
}) {
  const btn = (on: boolean) => `px-4 py-2 rounded-lg text-[13px] font-medium tracking-wide transition-colors ${on ? "bg-white text-[#0a0e1f]" : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {([["today", "Днес"], ["7d", "7 дни"], ["30d", "30 дни"]] as const).map(([k, l]) => (
        <button key={k} disabled={busy} onClick={() => onChange(k, market)} className={btn(period === k)}>{l}</button>
      ))}
      <span className="w-px h-6 bg-white/10 mx-1" />
      {([["all", "Всички"], ["bg", "🇧🇬 BG"], ["ro", "🇷🇴 RO"]] as const).map(([k, l]) => (
        <button key={k} disabled={busy} onClick={() => onChange(period, k)} className={btn(market === k)}>{l}</button>
      ))}
      <span className="ml-auto text-[11px] text-white/30 tabular-nums">{busy ? "зареждам…" : right}</span>
    </div>
  );
}
