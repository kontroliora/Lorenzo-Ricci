// "Получавате до вт, 21 окт" / "Primiți până marți, 21 oct": the date a parcel ordered NOW arrives at the latest, counted in working days.
// Pure (no React, no server imports): the product page, the cart and the tests use the same function. Clock = Europe/Sofia.
//
// BG (policy, app/policies/shipping): an order received by 14:00 on a working day is dispatched the same day, otherwise on the next working day;
//   Econt delivers on the NEXT working day after dispatch -> the date shown is dispatch + 1 working day (owner, 17.10.2026; Saturday -> dispatched Monday
//   -> Tuesday).
// RO (app/ro/politici/livrare): shipped from Bulgaria, 2-4 working days after dispatch; the policy promises no same-day dispatch, so dispatch is
//   the NEXT working day and the customer is told a RANGE: dispatch + 2 .. dispatch + 4 working days ("Primiți între X și Y").
// A working day is Monday-Friday and not a public holiday: for BG only the Bulgarian ones, for RO the Bulgarian (dispatch) and the Romanian (delivery)
// ones together. The holiday tables below run to the end of 2027 (checked by hand, not from an official feed): extend and re-check them every year
// (the unit test fails once the current year is past HOLIDAYS_KNOWN_UNTIL).

export type DeliveryMarket = "bg" | "ro";

export const BG_CUTOFF_HOUR = 14;           // same-day dispatch for orders received before this hour (Sofia time) on a working day
export const BG_DELIVERY_DAYS = 1;          // working days after dispatch: Econt delivers the next working day
export const RO_DELIVERY_DAYS_MIN = 2;      // working days after dispatch (the lower end of 2-4)
export const RO_DELIVERY_DAYS_MAX = 4;      // working days after dispatch (the upper end of 2-4)
export const HOLIDAYS_KNOWN_UNTIL = "2027-12-31";

// Fixed dates, Orthodox Easter (Good Friday .. Easter Monday), Pentecost Monday (RO), and the Monday that replaces a holiday falling on a weekend (BG).
const BG_HOLIDAYS = new Set([
  "2026-12-24", "2026-12-25", "2026-12-28",
  "2027-01-01", "2027-03-03", "2027-04-30", "2027-05-03", "2027-05-06", "2027-05-24", "2027-09-06", "2027-09-22", "2027-12-24", "2027-12-27", "2027-12-28",
]);
// Romania gives no replacement day for a holiday on a weekend (Union Day, Assumption, Christmas Day 2: left out when they fall on one).
const RO_HOLIDAYS = new Set([
  "2026-11-30", "2026-12-01", "2026-12-25",
  "2027-01-01", "2027-01-02", "2027-04-30", "2027-05-03", "2027-06-01", "2027-06-21", "2027-11-30", "2027-12-01",
]);

const TZ = "Europe/Sofia";
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Day = { y: number; m: number; d: number };
const key = ({ y, m, d }: Day) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const toUtc = ({ y, m, d }: Day) => Date.UTC(y, m - 1, d);
const fromUtc = (ms: number): Day => { const t = new Date(ms); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const addDays = (day: Day, n: number): Day => fromUtc(toUtc(day) + n * 86_400_000);
const weekdayOf = (day: Day): number => new Date(toUtc(day)).getUTCDay();

function sofiaNow(ms: number): { day: Day; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  const hour = Number(p.hour) === 24 ? 0 : Number(p.hour);
  void WD;
  return { day: { y: Number(p.year), m: Number(p.month), d: Number(p.day) }, minutes: hour * 60 + Number(p.minute) };
}

function isWorking(day: Day, market: DeliveryMarket): boolean {
  const wd = weekdayOf(day);
  if (wd === 0 || wd === 6) return false;
  const k = key(day);
  return !(BG_HOLIDAYS.has(k) || (market === "ro" && RO_HOLIDAYS.has(k)));
}
const nextWorking = (day: Day, market: DeliveryMarket): Day => { let x = addDays(day, 1); while (!isWorking(x, market)) x = addDays(x, 1); return x; };
const addWorking = (day: Day, n: number, market: DeliveryMarket): Day => { let x = day; for (let i = 0; i < n; i++) x = nextWorking(x, market); return x; };

export type DeliveryEstimate = {
  market: DeliveryMarket;
  date: Day;                 // the latest arrival day
  dateFrom: Day | null;      // RO: the earliest arrival day (the range starts here); BG: null
  weekday: number;           // 0 = Sunday
  dispatch: Day;             // the day the parcel leaves
  sameDayDispatch: boolean;  // it leaves today (BG, working day, before the cut-off)
  cutoffText: string | null; // BG: the cut-off sentence, RO: null
};

export function deliveryEstimate(nowMs: number, market: DeliveryMarket): DeliveryEstimate {
  const { day: today, minutes } = sofiaNow(nowMs);
  const sameDay = market === "bg" && isWorking(today, market) && minutes < BG_CUTOFF_HOUR * 60;
  const dispatch = sameDay ? today : nextWorking(today, market);
  const date = addWorking(dispatch, market === "bg" ? BG_DELIVERY_DAYS : RO_DELIVERY_DAYS_MAX, market);
  const dateFrom = market === "ro" ? addWorking(dispatch, RO_DELIVERY_DAYS_MIN, market) : null;
  return { market, date, dateFrom, weekday: weekdayOf(date), dispatch, sameDayDispatch: sameDay, cutoffText: market === "bg" ? `Поръчки до ${BG_CUTOFF_HOUR}:00 в работен ден се изпращат същия ден` : null };
}

const BG_WD = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
const BG_MON = ["ян", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];
const RO_WD = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
const RO_MON = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

/** BG: "Получавате до вт, 21 окт" (the next working day after dispatch); RO: "Primiți între miercuri, 21 oct și vineri, 23 oct" (2-4 working days after dispatch) */
export function deliveryText(est: DeliveryEstimate): string {
  const { date, dateFrom, weekday, market } = est;
  if (market === "bg") return `Получавате до ${BG_WD[weekday]}, ${date.d} ${BG_MON[date.m - 1]}`;
  const from = dateFrom ?? date;
  return `Primiți între ${RO_WD[weekdayOf(from)]}, ${from.d} ${RO_MON[from.m - 1]} și ${RO_WD[weekday]}, ${date.d} ${RO_MON[date.m - 1]}`;
}
