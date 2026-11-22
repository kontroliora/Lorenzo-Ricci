// Black Friday countdown strip under the top bar (owner, 22.11.2026). BG site only (the /ro chrome is separate).
// ONE place for the end moment, the phase switches and the wording. It only counts down: no price, offer or product reads this file.
//
// FIXED moments (Europe/Sofia, EET = UTC+2): the same for every visitor and every reload - nothing is stored per visitor.
// After the end the strip hides itself (client timer + an inline check before first paint), and the header / page offsets
// return to normal because --bf-h falls back to 0 (app/globals.css).
//
// Phases (the inline pre-paint check and the client timer set html.bf-day / html.bf-hours, app/globals.css styles them):
//   normal     -> label.normal, black strip
//   lastDayAt  -> label.lastDay, dark bordeaux strip
//   lastHoursAt-> label.lastHours, dark bordeaux strip
// On phones (< 640px) the long label is replaced by label.short so everything stays on one line.

export const BLACK_FRIDAY_COUNTDOWN = {
  enabled: true,
  endsAt: "2026-11-29T23:59:59+02:00",
  lastDayAt: "2026-11-29T00:00:00+02:00",
  lastHoursAt: "2026-11-29T18:00:00+02:00",
  href: "/namalenia",
  label: {
    normal: "ЧЕРЕН ПЕТЪК · ОФЕРТИТЕ ИЗТИЧАТ СЛЕД",
    lastDay: "ПОСЛЕДЕН ДЕН · ОФЕРТИТЕ ИЗТИЧАТ СЛЕД",
    lastHours: "ПОСЛЕДНИ ЧАСОВЕ · ИЗТИЧА СЛЕД",
    short: "ИЗТИЧА СЛЕД",
    /** /namalenia hero, under the subtitle (components/product/SaleCountdown.tsx). */
    salePage: "Офертите изтичат след",
    /** Home hero (components/home/BlackFridayHero.tsx). */
    hero: "Изтича след",
  },
} as const;

export const BLACK_FRIDAY_END_MS = Date.parse(BLACK_FRIDAY_COUNTDOWN.endsAt);
export const BLACK_FRIDAY_LAST_DAY_MS = Date.parse(BLACK_FRIDAY_COUNTDOWN.lastDayAt);
export const BLACK_FRIDAY_LAST_HOURS_MS = Date.parse(BLACK_FRIDAY_COUNTDOWN.lastHoursAt);

/** Days / hours / minutes / seconds in `msLeft` (never negative). */
export function countdownParts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export const blackFridayCountdownActive = (now: number = Date.now()): boolean =>
  BLACK_FRIDAY_COUNTDOWN.enabled && now <= BLACK_FRIDAY_END_MS;

/** Inline script for <head>/<body>: marks <html> with the current phase before first paint (no flash of the wrong text/colour). */
export const BLACK_FRIDAY_PREPAINT_JS =
  `(function(){var n=Date.now(),c=document.documentElement.classList;` +
  `if(n>${BLACK_FRIDAY_END_MS})c.add("bf-off");` +
  `else if(n>=${BLACK_FRIDAY_LAST_HOURS_MS})c.add("bf-hours");` +
  `else if(n>=${BLACK_FRIDAY_LAST_DAY_MS})c.add("bf-day")})()`;
