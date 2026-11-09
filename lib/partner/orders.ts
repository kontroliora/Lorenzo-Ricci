// What the PARTNER may see of an order (owner, 09.11.2026). He sees ONLY orders that contain women's-collection jewellery
// (Verdis, Noctis, Lumen, Linea, Solaris, Spira); of those he sees the WHOLE order (owner, 09.11.2026, later the same day: he
// calls the customer to confirm, so he needs every line - watches, cardholders, gifts - and the full amount to pay), with the
// collection lines flagged. Pure (no server imports): the partner API, the partner e-mail and the self-test use the same projection.
//
// partnerView() is the ONE place that turns an `orders` row into what he gets. It copies field by field, so a column added to
// `orders` later can never leak: never the customer's e-mail, notes, attribution or anything not listed here.

import { NEW_COLLECTION_SLUGS, COLLECTION_PIECES } from "../new-collection";
import { NEW_COLLECTION_PRODUCTS } from "../new-collection-products";
import { isRoOfficeMethod } from "../ro/config";

/** Orders of the collection start here (it went on sale in November 2026). */
export const PARTNER_SINCE = "2026-11-01T00:00:00.000Z";

/** The columns the server reads for him. NOT email, NOT notes, NOT attribution. */
export const PARTNER_ORDER_COLUMNS =
  "order_ref, created_at, name, phone, city, post_code, address, shipping_method, courier, ship_country, items, subtotal, shipping_cost, total, payment_method, payment_status, status, is_international";

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

/**
 * Is this order line a women's-collection piece? STRICT, by product id only: the line's slug must be one of the 18 collection
 * product ids (COLLECTION_PIECES: Verdis, Noctis, Lumen, Linea, Solaris, Spira x type x metal), exactly. Never by name, category,
 * price or prefix (men's jewellery shares "bracelet-" / "necklace-": bracelet-milano-forte, necklace-aurelius). A free gift line
 * does not count. The ONLY test that decides whether the partner sees / is e-mailed an order.
 */
export const isCollectionLine = (l: unknown): boolean => {
  if (!l || typeof l !== "object") return false;
  const x = l as Line;
  return !x.gift && typeof x.slug === "string" && NEW_COLLECTION_SLUGS.has(x.slug) && qty(x) > 0;
};

/** The collection lines of an order: an order is his when it has at least one. */
export const jewelleryLines = (row: Row): Line[] => linesOf(row).filter(isCollectionLine);

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
/** One line of the order. collection = a women's-collection piece (his); gift = a free line (price 0). */
export type PartnerItem = { model: string; color: string; stone: string; qty: number; price: number; sku: string; collection: boolean; gift: boolean };
export type PartnerOrderView = {
  ref: string;
  createdAt: string;
  market: "bg" | "ro";
  currency: "€" | "lei";
  name: string;
  phone: string;
  delivery: { courier: string; office: boolean; place: string };
  items: PartnerItem[];
  goods: number;            // every paid line, before discounts
  discount: number;         // all discounts of the order (1+1, promo code, card discount ...): goods + shipping - total
  shipping: number;
  total: number;            // the full order total the customer pays
  payment: { kind: "card" | "cod"; label: string; collect: number };   // collect = total (cash on delivery) or 0 (paid by card)
  storeCancelled: boolean;  // the shop cancelled the whole order
  state: { status: PartnerStatus; label: string; note: string; updatedAt: string | null };
};

export type PartnerState = { status?: string | null; note?: string | null; updated_at?: string | null } | null | undefined;

export function money(n: number, market: "bg" | "ro"): string {
  return market === "ro" ? `${Math.round(n)} lei` : `€${n.toFixed(2)}`;
}

export function partnerView(row: Row, state?: PartnerState): PartnerOrderView {
  const market: "bg" | "ro" = isRoRow(row) ? "ro" : "bg";
  const lines = linesOf(row);
  const goods = round2(lines.filter((l) => !l.gift).reduce((s, l) => s + Number(l.price ?? 0) * qty(l), 0));
  const shipping = round2(Number(row.shipping_cost ?? 0) || 0);
  const totalNum = Number(row.total);
  const total = round2(Number.isFinite(totalNum) && row.total !== null && row.total !== undefined ? totalNum : goods + shipping);
  const discount = round2(Math.max(0, goods + shipping - total));
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
      const p = isCollectionLine(l) || (l.gift && typeof l.slug === "string" && NEW_COLLECTION_SLUGS.has(l.slug)) ? pieceInfo(String(l.slug)) : undefined;
      const gift = !!l.gift;
      return {
        model: p?.model ?? String(l.name ?? ""), color: p?.color ?? "", stone: p?.stone ?? "", qty: qty(l),
        price: gift ? 0 : Number(l.price ?? 0), sku: p?.sku ?? String(l.sku ?? ""), collection: !!p, gift,
      };
    }),
    goods,
    discount,
    shipping,
    total,
    payment: card
      ? { kind: "card", label: "ПЛАТЕНО С КАРТА", collect: 0 }
      : { kind: "cod", label: `НАЛОЖЕН ПЛАТЕЖ — ${money(total, market)}`, collect: total },
    storeCancelled: String(row.status ?? "") === "cancelled",
    state: { status, label: PARTNER_STATUS_LABEL[status], note: String(state?.note ?? ""), updatedAt: state?.updated_at ?? null },
  };
}

/** Keys a view may hold: the self-test checks every record against this list (and that no e-mail address appears anywhere). */
export const PARTNER_VIEW_KEYS = ["ref", "createdAt", "market", "currency", "name", "phone", "delivery", "items", "goods", "discount", "shipping", "total", "payment", "storeCancelled", "state"];
