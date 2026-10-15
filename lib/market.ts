// Which market an order belongs to, and how the panel shows its money. Client-safe (no server imports).
//
// Romanian orders (placed on /ro) live in the same "Поръчки" list as the Bulgarian ones. They are stored with
// is_international = true: that flag is the switch the Bulgarian-only automations check (Econt waybill matching, Econt status
// sync, the "parcel waits at the office" reminder, the Bulgarian "shipped" e-mail), so none of them touches a Romanian order.
// The "Международни" (Dubai waitlist) view and the order board use isRoOrder() to tell the two apart.
import { EUR_RON } from "@/lib/ro/config";

export type Market = "bg" | "ro";

type MarketFields = { ship_country?: string | null; order_ref?: string | null };

/** Placed on the Romanian site: ship_country RO, or the LRRO- reference (works before any column exists). */
export const isRoOrder = (o: MarketFields): boolean => o.ship_country === "RO" || String(o.order_ref ?? "").startsWith("LRRO-");
export const marketOf = (o: MarketFields): Market => (isRoOrder(o) ? "ro" : "bg");

/** Lei -> euro at the owner's rate (1 EUR = 5.25 RON), for the "about" figures in the panel. */
export const euroOfLei = (lei: number): number => Number(lei ?? 0) / EUR_RON;

const num = (n: number) => Math.round(Number(n ?? 0)).toLocaleString("bg-BG");
/** "735 лея" */
export const fmtLei = (lei: number): string => `${num(lei)} лея`;
/** "735 лея ≈ €140" */
export const fmtLeiWithEuro = (lei: number): string => `${fmtLei(lei)} ≈ €${num(euroOfLei(lei))}`;
