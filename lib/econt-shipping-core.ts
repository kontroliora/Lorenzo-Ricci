// Econt товарителници (owner, 27.11.2026) - the PURE part: no server or Next imports, so the tests run it as is.
// Builds the LabelService.createLabel body from an order, picks the Econt account, matches a CHRONOBG office text to Econt's
// office list and turns Econt's error tree into one readable Bulgarian line. lib/econt-shipping.ts does the I/O.

import { hasCardMoney, cardMoneyMissing } from "./payments";
import { isCollectionLine } from "./partner/orders";

// ── Constants ────────────────────────────────────────────────────────────────

/** Default parcel weight per product type, kg. A line we cannot classify counts as a watch (the heavier, safe side). */
export const LABEL_WEIGHT_KG = {
  watch: 0.5,
  jewellery: 0.2,
  leather_small: 0.3,   // wallets, cardholders
  bag: 1.0,
  unknown: 0.5,
} as const;
export const LABEL_MIN_WEIGHT_KG = 0.2;
export const LABEL_DESCRIPTION = "Аксесоари";   // never prices in the description
export const LABEL_PACK_COUNT = 1;

export type EcontAccount = "lorenzo-ricci" | "chronobg" | "partner";
export const ACCOUNT_LABEL: Record<EcontAccount, string> = { "lorenzo-ricci": "Lorenzo Ricci", chronobg: "CHRONOBG", partner: "партньора" };

// ── Order shape the builder needs ───────────────────────────────────────────

type Line = { slug?: string; name?: string; quantity?: number; qty?: number; gift?: boolean; price?: number };
export type LabelOrder = {
  id: number;
  order_ref?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  post_code?: string | null;
  address?: string | null;
  courier?: string | null;
  shipping_method?: string | null;
  econt_office_code?: string | null;
  items?: Line[] | null;
  total?: number | null;
  status?: string | null;
  source_site?: string | null;
  ship_country?: string | null;
  is_international?: boolean | null;
  excluded_from_stock?: boolean | null;
  payment_method?: string | null;
  payment_status?: string | null;
  stripe_payment_intent?: string | null;
};

/** slug -> category ("watches", "jewellery", "bracelet", "necklace", "wallets", "cardholders", "bags"). Fed by the server. */
export type CategoryOf = (slug: string) => string | undefined;

const qtyOf = (l: Line) => Math.max(1, Number(l.quantity ?? l.qty ?? 1) || 1);

export function lineWeight(l: Line, categoryOf: CategoryOf): number {
  const cat = l.slug ? categoryOf(l.slug) : undefined;
  if (cat === "watches") return LABEL_WEIGHT_KG.watch;
  if (cat === "jewellery" || cat === "bracelet" || cat === "necklace" || isCollectionLine(l)) return LABEL_WEIGHT_KG.jewellery;
  if (cat === "wallets" || cat === "cardholders") return LABEL_WEIGHT_KG.leather_small;
  if (cat === "bags") return LABEL_WEIGHT_KG.bag;
  return LABEL_WEIGHT_KG.unknown;
}

/** Parcel weight: every line (gifts too - they are in the box) x its quantity, at least LABEL_MIN_WEIGHT_KG, 2 decimals. */
export function orderWeight(o: Pick<LabelOrder, "items">, categoryOf: CategoryOf): number {
  const lines = (o.items ?? []).filter((l) => l && typeof l === "object");
  const kg = lines.reduce((s, l) => s + lineWeight(l, categoryOf) * qtyOf(l), 0);
  return Math.round(Math.max(LABEL_MIN_WEIGHT_KG, kg || LABEL_WEIGHT_KG.unknown) * 100) / 100;
}

/** Every paid line is a women's-collection piece (the partner's order). */
export function isJewelleryOnly(o: Pick<LabelOrder, "items">): boolean {
  const paid = (o.items ?? []).filter((l) => l && !l.gift);
  return paid.length > 0 && paid.every(isCollectionLine);
}

// ── Sender groups (table shipping_senders, supabase/shipping_senders.sql) ─────
// Which sender (office + person) and which Econt account an order ships from. Mixed orders (watch + jewellery) are "main".
export type SenderGroup = "main" | "womens_jewelry" | "chronobg";
export const SENDER_GROUPS: { key: SenderGroup; label: string }[] = [
  { key: "main", label: "Основни (всичко без само дамски бижута)" },
  { key: "womens_jewelry", label: "Само дамски бижута" },
  { key: "chronobg", label: "CHRONOBG" },
];
export type DbAccount = "lr" | "chronobg" | "partner";
export type SenderRow = {
  sender_group: SenderGroup;
  econt_office_code: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  econt_account: DbAccount;
  updated_by?: string | null;
  updated_at?: string | null;
};

export function senderGroupOf(o: Pick<LabelOrder, "source_site" | "items">): SenderGroup {
  if (o.source_site === "chronobg") return "chronobg";
  return isJewelleryOnly(o) ? "womens_jewelry" : "main";
}

export const accountOfDb = (a: string | null | undefined): EcontAccount => (a === "chronobg" ? "chronobg" : a === "partner" ? "partner" : "lorenzo-ricci");
export const dbOfAccount = (a: EcontAccount): DbAccount => (a === "lorenzo-ricci" ? "lr" : a);

export const NO_SENDER = "Няма зададен подател за тази група";

/** Why this group's row cannot be used (never a fallback to another group), or null. */
export function senderProblem(group: SenderGroup, row: SenderRow | null | undefined): string | null {
  const label = SENDER_GROUPS.find((g) => g.key === group)?.label ?? group;
  if (!row || !String(row.econt_office_code ?? "").trim()) return `${NO_SENDER} („${label}“): липсва офис.`;
  if (!String(row.sender_name ?? "").trim()) return `${NO_SENDER} („${label}“): липсва име на подателя.`;
  if (!String(row.sender_phone ?? "").replace(/\D/g, "")) return `${NO_SENDER} („${label}“): липсва телефон на подателя.`;
  if (group === "chronobg" && row.econt_account !== "chronobg") return `Групата CHRONOBG трябва да е от акаунта на CHRONOBG.`;
  return null;
}

/** Office delivery (vs. door). The checkout writes courier 'econt' / 'home'; chronobg is always office. */
export function isOfficeDelivery(o: Pick<LabelOrder, "courier" | "shipping_method" | "source_site">): boolean {
  if (o.source_site === "chronobg") return true;
  if (o.courier === "home") return false;
  if (o.courier === "econt") return true;
  return !/адрес/i.test(String(o.shipping_method ?? ""));
}

/** The office code: the column, else the "(код 1234)" the checkout writes into the address. */
export function officeCodeOf(o: Pick<LabelOrder, "econt_office_code" | "address">): string | null {
  const c = String(o.econt_office_code ?? "").trim();
  if (c) return c;
  const m = String(o.address ?? "").match(/\(код\s*(\d{3,6})\)/i);
  return m ? m[1] : null;
}

/** Cash on delivery: the whole total, unless the money is already in Stripe (card / Revolut Pay through Stripe). */
export function codAmountOf(o: LabelOrder): number {
  return hasCardMoney(o) ? 0 : Math.round((Number(o.total) || 0) * 100) / 100;
}

// ── Why an order may NOT get a label (checked on the server, not only in the UI) ──

export function labelBlockReason(o: LabelOrder): string | null {
  const ref = o.order_ref ?? `#${o.id}`;
  if (o.status === "cancelled") return `Поръчка ${ref} е отказана/анулирана: товарителница не се създава.`;
  if (o.status !== "confirmed") return `Поръчка ${ref} не е потвърдена (статус „${o.status ?? "—"}“): товарителница се прави само за потвърдени.`;
  if (o.ship_country === "RO" || String(o.order_ref ?? "").startsWith("LRRO-")) return `Поръчка ${ref} е румънска: тя не се изпраща с Еконт.`;
  if (o.is_international) return `Поръчка ${ref} е международна: не се изпраща с Еконт.`;
  if (o.excluded_from_stock) return `Поръчка ${ref} е маркирана като фалшива/тестова.`;
  if (o.payment_status === "refunded") return `Плащането на ${ref} е върнато в Stripe: не изпращай.`;
  if (cardMoneyMissing(o)) return `СТОП: ${ref} е с плащане с карта, но плащане няма. Провери в Stripe.`;
  if (!String(o.name ?? "").trim()) return `Поръчка ${ref} няма име на получател.`;
  if (!String(o.phone ?? "").replace(/\D/g, "")) return `Поръчка ${ref} няма телефон на получател.`;
  if (!hasCardMoney(o) && codAmountOf(o) <= 0) return `Поръчка ${ref} е с наложен платеж, но сумата е 0.`;
  return null;
}

// ── Sender ──────────────────────────────────────────────────────────────────

/** client = the company (the Econt account's profile); agent = the person of the group who hands it over; officeCode = the group's office. */
export type Sender = {
  client: { name: string; phones: string[]; email?: string };
  agent?: { name: string; phones: string[] } | null;
  officeCode: string;
};

// ── The createLabel body ────────────────────────────────────────────────────

export type BuildResult = { label: Record<string, unknown> } | { error: string };

/** officeCode: for office delivery, the resolved receiver office (already matched for chronobg). */
export function buildLabel(o: LabelOrder, sender: Sender, categoryOf: CategoryOf, officeCode: string | null): BuildResult {
  const blocked = labelBlockReason(o);
  if (blocked) return { error: blocked };
  if (!sender.officeCode) return { error: NO_SENDER };

  const label: Record<string, unknown> = {
    senderClient: sender.client,
    ...(sender.agent ? { senderAgent: sender.agent } : {}),
    senderOfficeCode: sender.officeCode,
    receiverClient: {
      name: String(o.name).trim(),
      phones: [String(o.phone).trim()],
      ...(o.email && /@/.test(o.email) ? { email: o.email.trim() } : {}),
    },
    packCount: LABEL_PACK_COUNT,
    shipmentType: "PACK",
    weight: orderWeight(o, categoryOf),
    shipmentDescription: LABEL_DESCRIPTION,
    orderNumber: o.order_ref ?? String(o.id),   // printed on the label: Koko matches box <-> order
  };

  if (isOfficeDelivery(o)) {
    if (!officeCode) return { error: `Липсва офис на Еконт за поръчка ${o.order_ref ?? o.id}.` };
    label.receiverOfficeCode = officeCode;
  } else {
    const city = String(o.city ?? "").trim();
    const street = String(o.address ?? "").trim();
    if (!city || !street) return { error: `Непълен адрес за доставка (град: „${city || "—"}“, адрес: „${street || "—"}“).` };
    label.receiverAddress = {
      city: { country: { code3: "BGR" }, name: city, ...(String(o.post_code ?? "").trim() ? { postCode: String(o.post_code).trim() } : {}) },
      other: street,
    };
    label.holidayDeliveryDay = "workday";   // Econt asks "which day" for door delivery before a holiday/weekend
  }

  const cod = codAmountOf(o);
  if (cod > 0) label.services = { cdAmount: cod, cdType: "get", cdCurrency: "EUR" };
  return { label };
}

// ── Econt errors -> one Bulgarian line ──────────────────────────────────────

type EcontErr = { type?: string; message?: string; innerErrors?: EcontErr[] };

export function econtErrorText(e: unknown): string {
  const parts: string[] = [];
  const walk = (x: EcontErr | undefined, prefix: string) => {
    if (!x) return;
    const msg = String(x.message ?? "").trim().replace(/:\s*$/, "");
    const here = [prefix, msg].filter(Boolean).join(": ").trim();
    const inner = Array.isArray(x.innerErrors) ? x.innerErrors : [];
    if (!inner.length) { if (here) parts.push(here); return; }
    for (const i of inner) walk(i, here);
  };
  walk(e as EcontErr, "");
  const text = [...new Set(parts)].join("; ").replace(/\s+/g, " ").trim();
  return text ? `Еконт: ${text}` : "Еконт върна грешка без описание.";
}

// ── CHRONOBG office text -> Econt office code ───────────────────────────────

export type OfficeRow = { c: string; n: string; e?: string; a?: string; i: number; t?: string };
export type CityRow = { i: number; n: string; e?: string };

// Words that say nothing about WHICH office ("Офис на Еконт гр. Варна ..."). Tokens, because \b does not see Cyrillic.
const OFFICE_STOP = new Set(["офис", "еконт", "econt", "office", "еконтомат", "автомат", "на", "гр", "град", "до"]);
export const normOffice = (s: string): string =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w && !OFFICE_STOP.has(w))
    .join(" ");

/** One office for (city, text), or null when none / more than one fit. An office code inside the text wins. */
export function matchOffice(city: string | null | undefined, text: string | null | undefined, offices: OfficeRow[], cities: CityRow[]): string | null {
  const t = String(text ?? "");
  const byCode = t.match(/\b(\d{3,6})\b/g)?.map((c) => offices.find((o) => o.c === c)).filter(Boolean) ?? [];
  if (byCode.length === 1) return byCode[0]!.c;

  const nCity = normOffice(city ?? "");
  const nText = normOffice(t);
  if (!nText) return null;
  const cityIds = new Set(cities.filter((c) => nCity && (normOffice(c.n) === nCity || normOffice(c.e ?? "") === nCity)).map((c) => c.i));
  const pool = cityIds.size ? offices.filter((o) => cityIds.has(o.i)) : offices;

  // The office name with and without the city prefix ("Варна Аспарухово" / "Аспарухово").
  const names = (o: OfficeRow) => {
    const n = normOffice(o.n);
    const out = new Set([n]);
    if (nCity && n.startsWith(nCity + " ")) out.add(n.slice(nCity.length + 1));
    const e = normOffice(o.e ?? "");
    if (e) out.add(e);
    return [...out].filter(Boolean);
  };
  const textNoCity = nCity && nText.startsWith(nCity + " ") ? nText.slice(nCity.length + 1) : nText;

  const exact = pool.filter((o) => names(o).some((n) => n === nText || n === textNoCity));
  if (exact.length === 1) return exact[0].c;
  if (exact.length > 1) return null;
  const contains = pool.filter((o) => names(o).some((n) => n.length >= 4 && (nText.includes(n) || n.includes(textNoCity) && textNoCity.length >= 4)));
  return contains.length === 1 ? contains[0].c : null;
}
