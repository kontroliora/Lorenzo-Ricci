// What the PARTNER may see of an order (owner, 09.11.2026): ONLY the women's-collection jewellery (Verdis, Noctis, Lumen, Linea,
// Solaris, Spira). Pure (no server imports): the partner API, the partner e-mail and the self-test use the same projection.
//
// partnerView() is the ONE place that turns an `orders` row into what he gets. It copies field by field, so a column added to
// `orders` later can never leak: never the customer's e-mail, never other lines (watches, cardholders ...), never the order total.

import { NEW_COLLECTION_SLUGS, COLLECTION_PIECES } from "../new-collection";
import { NEW_COLLECTION_PRODUCTS } from "../new-collection-products";
import { onePlusOneOfOrder } from "../one-plus-one";
import { isRoOfficeMethod } from "../ro/config";

/** Orders of the collection start here (it went on sale in November 2026). */
export const PARTNER_SINCE = "2026-11-01T00:00:00.000Z";

/** The columns the server reads for him. NOT email, NOT total, NOT notes, NOT attribution. */
export const PARTNER_ORDER_COLUMNS =
  "order_ref, created_at, name, phone, city, post_code, address, shipping_method, courier, ship_country, items, subtotal, promo_discount, payment_method, payment_status, status, is_international";

export const PARTNER_STATUSES = ["new", "called", "confirmed", "cancelled", "no_answer"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  new: "Нова", called: "Обадено", confirmed: "Потвърдено", cancelled: "Отказано", no_answer: "Не вдига",
};
/** The statuses he may set (Нова is only the starting point). */
export const PARTNER_SETTABLE: PartnerStatus[] = ["called", "confirmed", "cancelled", "no_answer"];
export const isPartnerStatus = (s: unknown): s is PartnerStatus => typeof s === "string" && (PARTNER_STATUSES as readonly string[]).includes(s);

export type PartnerFilter = "new" | "called" | "confirmed" | "all";
/** Нови = not handled yet (incl. "не вдига": call again); Обадени = he reached them; Потвърдени; Всички. */
export function matchesFilter(status: PartnerStatus, f: PartnerFilter): boolean {
  if (f === "all") return true;
  if (f === "new") return status === "new" || status === "no_answer";
  if (f === "called") return status === "called";
  return status === "confirmed";
}

type Row = Record<string, unknown>;
type Line = { slug?: unknown; name?: unknown; sku?: unknown; quantity?: unknown; qty?: unknown; price?: unknown; gift?: unknown };

const qty = (l: Line) => Math.max(1, Math.floor(Number(l.quantity ?? l.qty ?? 1)) || 1);
const round2 = (n: number) => Math.round(n * 100) / 100;
const linesOf = (row: Row): Line[] => (Array.isArray(row.items) ? (row.items as Line[]) : []);

/** The jewellery lines of an order (paid lines only: a free gift is not part of the collection's sale). */
export const jewelleryLines = (row: Row): Line[] =>
  linesOf(row).filter((l) => !l.gift && typeof l.slug === "string" && NEW_COLLECTION_SLUGS.has(l.slug));

export const isRoRow = (row: Row): boolean => row.ship_country === "RO" || String(row.order_ref ?? "").startsWith("LRRO-");
export const isCardRow = (row: Row): boolean => row.payment_method === "card";

/**
 * May he see this order at all? Holds jewellery, is not an international lead, and a card order only once it is PAID
 * (an open / failed card attempt is never shown).
 */
export function partnerVisible(row: Row): boolean {
  if (!jewelleryLines(row).length) return false;
  if (row.is_international === true && !isRoRow(row)) return false;   // international leads (Dubai); Romanian orders carry the flag too
  if (String(row.status ?? "") === "pending_payment") return false;
  if (isCardRow(row) && row.payment_status !== "paid") return false;
  return String(row.created_at ?? "") >= PARTNER_SINCE;
}

// ── the pieces ───────────────────────────────────────────────────────────────
const TYPE_BG = { necklace: "Колие", bracelet: "Гривна" } as const;
const COLOR_BG = { gold: "Златен", silver: "Сребърен" } as const;

export type PieceInfo = { slug: string; model: string; color: string; stone: string; sku: string };
const PIECES: Map<string, PieceInfo> = new Map(COLLECTION_PIECES.map((p) => {
  const product = NEW_COLLECTION_PRODUCTS.find((x) => x.slug === p.slug);
  const spec = (label: string) => product?.specs?.find((s) => s.label === label)?.value?.trim() ?? "";
  const inlay = spec("Вложка");
  const stones = spec("Камъни");
  return [p.slug, {
    slug: p.slug,
    model: `${TYPE_BG[p.type]} ${p.design.name}`,
    color: COLOR_BG[p.metal],
    stone: inlay ? `${inlay} вложка` : stones,
    sku: product?.sku ?? "",
  }];
}));
export const pieceInfo = (slug: string): PieceInfo | undefined => PIECES.get(slug);

// ── the view ─────────────────────────────────────────────────────────────────
export type PartnerItem = { model: string; color: string; stone: string; qty: number; price: number; sku: string };
export type PartnerOrderView = {
  ref: string;
  createdAt: string;
  market: "bg" | "ro";
  currency: "€" | "lei";
  name: string;
  phone: string;
  delivery: { courier: string; office: boolean; place: string };
  items: PartnerItem[];
  jewelleryGross: number;   // the jewellery lines before the 1+1
  onePlusOne: number;       // the 1+1 discount on them
  jewelleryTotal: number;   // after the 1+1
  payment: { kind: "card" | "cod"; label: string; collect: number };
  storeCancelled: boolean;  // the shop cancelled the whole order
  state: { status: PartnerStatus; label: string; note: string; updatedAt: string | null };
};

export type PartnerState = { status?: string | null; note?: string | null; updated_at?: string | null } | null | undefined;

export function money(n: number, market: "bg" | "ro"): string {
  return market === "ro" ? `${Math.round(n)} lei` : `€${n.toFixed(2)}`;
}

export function partnerView(row: Row, state?: PartnerState): PartnerOrderView {
  const market: "bg" | "ro" = isRoRow(row) ? "ro" : "bg";
  const lines = jewelleryLines(row);
  const all = linesOf(row).filter((l) => !l.gift);
  // the order's discount on goods (lines - goods after discounts - promo code): the 1+1 is checked against it
  const grossAll = all.reduce((s, l) => s + Number(l.price ?? 0) * qty(l), 0);
  const orderDiscount = Math.max(0, grossAll - Number(row.subtotal ?? grossAll) - Number(row.promo_discount ?? 0));
  const gross = round2(lines.reduce((s, l) => s + Number(l.price ?? 0) * qty(l), 0));
  const opo = round2(onePlusOneOfOrder(lines.map((l) => ({ ...l, quantity: qty(l) })), orderDiscount));
  const total = round2(gross - opo);
  const card = isCardRow(row);
  const where = [row.address, row.city, row.post_code].map((s) => String(s ?? "").trim()).filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i).join(", ");
  const status: PartnerStatus = isPartnerStatus(state?.status) ? state!.status as PartnerStatus : "new";
  return {
    ref: String(row.order_ref ?? ""),
    createdAt: String(row.created_at ?? ""),
    market,
    currency: market === "ro" ? "lei" : "€",
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    delivery: {
      courier: market === "ro" ? "Speedy" : "Еконт",
      office: market === "ro" ? isRoOfficeMethod(row.shipping_method) : String(row.courier ?? "") !== "home",
      place: where,
    },
    items: lines.map((l) => {
      const p = pieceInfo(String(l.slug));
      return { model: p?.model ?? String(l.name ?? ""), color: p?.color ?? "", stone: p?.stone ?? "", qty: qty(l), price: Number(l.price ?? 0), sku: p?.sku ?? String(l.sku ?? "") };
    }),
    jewelleryGross: gross,
    onePlusOne: opo,
    jewelleryTotal: total,
    payment: card
      ? { kind: "card", label: "ПЛАТЕНО С КАРТА", collect: 0 }
      : { kind: "cod", label: `НАЛОЖЕН ПЛАТЕЖ — ${money(total, market)}`, collect: total },
    storeCancelled: String(row.status ?? "") === "cancelled",
    state: { status, label: PARTNER_STATUS_LABEL[status], note: String(state?.note ?? ""), updatedAt: state?.updated_at ?? null },
  };
}

/** Keys a view may hold: the self-test checks every record against this list (and that no e-mail address appears anywhere). */
export const PARTNER_VIEW_KEYS = ["ref", "createdAt", "market", "currency", "name", "phone", "delivery", "items", "jewelleryGross", "onePlusOne", "jewelleryTotal", "payment", "storeCancelled", "state"];
