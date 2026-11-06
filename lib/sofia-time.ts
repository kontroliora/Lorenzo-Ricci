// Europe/Sofia calendar helpers for the panel's "Днес / 7 дни / 30 дни" windows (the server runs in UTC).
export type PeriodKey = "today" | "7d" | "30d";
export type Market = "all" | "bg" | "ro";

const parts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};

/** Sofia date (YYYY-MM-DD) of an instant. */
export const sofiaDay = (d = new Date()): string => {
  const p = parts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};

/** Minutes Sofia is ahead of UTC at that instant (120 in winter, 180 in summer). */
const offsetMin = (d: Date): number => {
  const p = parts(d);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
};

/** The UTC instant of 00:00 Sofia on the given Sofia date. */
export function sofiaMidnight(day: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const first = new Date(guess.getTime() - offsetMin(guess) * 60_000);
  return new Date(guess.getTime() - offsetMin(first) * 60_000);
}

/** Sofia date `n` days before `day`. */
export const shiftDay = (day: string, n: number): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Window of a period: from 00:00 Sofia of its first day until now; plus the Sofia dates (for Meta's daily rows). */
export function periodRange(key: PeriodKey, now = new Date()) {
  const today = sofiaDay(now);
  const back = key === "today" ? 0 : key === "7d" ? 6 : 29;
  const sinceDay = shiftDay(today, back);
  return { startISO: sofiaMidnight(sinceDay).toISOString(), endISO: now.toISOString(), sinceDay, untilDay: today, days: back + 1 };
}

/** Hour (0-23) in Sofia right now. */
export const sofiaHour = (d = new Date()): number => parts(d).h;
