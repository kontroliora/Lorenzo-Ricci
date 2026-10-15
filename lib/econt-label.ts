// Client-safe pieces of the Econt office list (no server imports): the slim record, its type names and the label saved as the address.

/** t: o = office, a = automat (Еконтомат, isAPS), m = mobile office (isMPS) */
export type SlimOffice = { c: string; n: string; e: string; a: string; i: number; t: "o" | "a" | "m" };
export type SlimCity = { i: number; n: string; e: string };
export type OfficeList = { updated: string; cities: SlimCity[]; offices: SlimOffice[] };

export const OFFICE_TYPE_LABEL: Record<SlimOffice["t"], string> = { o: "Офис", a: "Еконтомат", m: "Мобилен офис" };

/** The text saved as the order's delivery address (the team reads it, the customer sees it in the e-mail). */
export const officeLabel = (o: SlimOffice): string =>
  `${OFFICE_TYPE_LABEL[o.t]} на Еконт: ${o.n} (код ${o.c})${o.a ? `, ${o.a}` : ""}`;
