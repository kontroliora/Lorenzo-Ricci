// Black Friday countdown strip under the top bar (owner, 22.11.2026). BG site only (the /ro chrome is separate).
// ONE place for the end moment and the wording. It only counts down: no price, offer or product reads this file.
//
// FIXED end moment (Europe/Sofia, EET = UTC+2): the same for every visitor and every reload - nothing is stored per visitor.
// After it passes the strip hides itself (client timer + an inline check before first paint), and the header / page offsets
// return to normal because --bf-h falls back to 0 (app/globals.css).

export const BLACK_FRIDAY_COUNTDOWN = {
  enabled: true,
  endsAt: "2026-11-29T23:59:59+02:00",
  label: "ЧЕРЕН ПЕТЪК · до 29.11",
} as const;

export const BLACK_FRIDAY_END_MS = Date.parse(BLACK_FRIDAY_COUNTDOWN.endsAt);

export const blackFridayCountdownActive = (now: number = Date.now()): boolean =>
  BLACK_FRIDAY_COUNTDOWN.enabled && now <= BLACK_FRIDAY_END_MS;
