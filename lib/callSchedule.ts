// Call-schedule windows for the order-calling workflow. Two windows per weekday
// in Bulgarian time: 10:00–12:00 and 18:00–20:00. Everything here is PURE and
// derived from timestamps — no DB state beyond the order's own call_attempts /
// last_attempt_at / call_attempt_times. Used by the panel to show the visual
// timer; there is no penalty attached, it's guidance only.

const TZ = "Europe/Sofia";

type Parts = { hour: number; minute: number; weekday: number; minutesOfDay: number; dateKey: string };

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_NAMES = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];

const WINDOWS = [
  { key: "am", startMin: 10 * 60, endMin: 12 * 60, label: "10:00–12:00" },
  { key: "pm", startMin: 18 * 60, endMin: 20 * 60, label: "18:00–20:00" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

// Local wall-clock parts in Europe/Sofia for a given instant, via Intl (DST-safe,
// identical on server and client for the same input).
function sofiaParts(ms: number): Parts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const m: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) m[p.type] = p.value;
  let hour = Number(m.hour);
  if (hour === 24) hour = 0; // some runtimes emit '24' at midnight
  const minute = Number(m.minute);
  return {
    hour, minute,
    weekday: WD[m.weekday] ?? 0,
    minutesOfDay: hour * 60 + minute,
    dateKey: `${m.year}-${m.month}-${m.day}`,
  };
}

export function sofiaHHMM(ms: number): string {
  const p = sofiaParts(ms);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// The window we're inside right now, or null (outside / weekend).
export function activeWindow(ms: number): { key: string; label: string } | null {
  const p = sofiaParts(ms);
  if (p.weekday < 1 || p.weekday > 5) return null;
  for (const w of WINDOWS) {
    if (p.minutesOfDay >= w.startMin && p.minutesOfDay < w.endMin) return { key: w.key, label: w.label };
  }
  return null;
}

// The next window that starts after `ms`, with a Bulgarian day label.
export function nextWindow(ms: number): { when: string; label: string } {
  const p = sofiaParts(ms);
  if (p.weekday >= 1 && p.weekday <= 5) {
    if (p.minutesOfDay < WINDOWS[0].startMin) return { when: "днес", label: WINDOWS[0].label };
    if (p.minutesOfDay < WINDOWS[1].startMin) return { when: "днес", label: WINDOWS[1].label };
  }
  let add = 1, wd = p.weekday;
  for (let i = 0; i < 8; i++) { wd = (p.weekday + add) % 7; if (wd >= 1 && wd <= 5) break; add++; }
  return { when: add === 1 ? "утре" : `в ${DAY_NAMES[wd]}`, label: WINDOWS[0].label };
}

// Did the given attempt fall inside the currently-active window (same Sofia day)?
function attemptInActiveWindow(attemptMs: number, nowMs: number, windowKey: string): boolean {
  const a = sofiaParts(attemptMs), n = sofiaParts(nowMs);
  if (a.dateKey !== n.dateKey) return false;
  const w = WINDOWS.find((x) => x.key === windowKey);
  return !!w && a.minutesOfDay >= w.startMin && a.minutesOfDay < w.endMin;
}

export type CallTimer =
  | { status: "due"; activeLabel: string }
  | { status: "called_this_window"; next: { when: string; label: string } }
  | { status: "outside"; next: { when: string; label: string } }
  | { status: "exhausted" };

// Derive the per-order timer state. 3 attempts max, then it waits for manual close.
export function callTimer(callAttempts: number, lastAttemptMs: number | null, nowMs: number): CallTimer {
  if (callAttempts >= 3) return { status: "exhausted" };
  const active = activeWindow(nowMs);
  if (active) {
    if (lastAttemptMs && attemptInActiveWindow(lastAttemptMs, nowMs, active.key)) {
      return { status: "called_this_window", next: nextWindow(nowMs) };
    }
    return { status: "due", activeLabel: active.label };
  }
  return { status: "outside", next: nextWindow(nowMs) };
}

// "опит 1: 10:15 · опит 2: 18:30 · опит 3: 10:22 (следв. ден)"
export function formatAttemptList(isoTimes: string[]): string {
  if (!isoTimes.length) return "";
  const firstKey = sofiaParts(Date.parse(isoTimes[0])).dateKey;
  return isoTimes.map((t, i) => {
    const p = sofiaParts(Date.parse(t));
    const nextDay = p.dateKey !== firstKey ? " (следв. ден)" : "";
    return `опит ${i + 1}: ${pad(p.hour)}:${pad(p.minute)}${nextDay}`;
  }).join(" · ");
}

// Owner audit view: each attempt with its exact time AND which window it fell in.
export function formatAttemptAudit(isoTimes: string[]): string[] {
  const firstKey = isoTimes.length ? sofiaParts(Date.parse(isoTimes[0])).dateKey : "";
  return isoTimes.map((t, i) => {
    const p = sofiaParts(Date.parse(t));
    const w = WINDOWS.find((x) => p.minutesOfDay >= x.startMin && p.minutesOfDay < x.endMin);
    const nextDay = p.dateKey !== firstKey ? " (следв. ден)" : "";
    return `опит ${i + 1}: ${pad(p.hour)}:${pad(p.minute)}${nextDay} · ${w ? w.label : "извън прозорец"}`;
  });
}
