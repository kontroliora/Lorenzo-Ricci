import type { ShipmentAnalysis } from "../econt";

// "Непотърсени" for the partner (owner, 12.11.2026): his shipped orders waiting at the customer's Econt office, from the 3rd day there,
// so he can phone a reminder (the e-mail reminder goes on day 4, lib/shipment-notify.ts). Econt keeps a parcel ~7 working days
// (about 9 calendar days) before sending it back. Pure: the server feeds it the Econt analysis (lib/partner/server.ts).

export const PICKUP_CALL_FROM_DAY = 3;
const STORAGE_CALENDAR_DAYS = 9;
const DAY = 86_400_000;

export type PickupInfo = { day: number; office: string; since: string; returnsInDays: number };
export type PickupFacts = Pick<ShipmentAnalysis, "delivered" | "returning" | "atFinalOffice" | "arrivedAtFinalOfficeMs" | "officeName">;

/** Waiting at the office since day >= 3 (day 1 = the day it arrived), not collected, not on its way back; null otherwise. */
export function pickupInfoOf(a: PickupFacts | null | undefined, nowMs = Date.now()): PickupInfo | null {
  if (!a || a.delivered || a.returning || !a.atFinalOffice || !a.arrivedAtFinalOfficeMs) return null;
  const day = Math.floor((nowMs - a.arrivedAtFinalOfficeMs) / DAY) + 1;
  if (day < PICKUP_CALL_FROM_DAY) return null;
  return { day, office: a.officeName || "офис на Еконт", since: new Date(a.arrivedAtFinalOfficeMs).toISOString(), returnsInDays: Math.max(0, STORAGE_CALENDAR_DAYS - day) };
}
