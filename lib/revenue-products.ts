// Оборот tab - per category / per product, from each order's own lines (owner, 12.11.2026). Read-only, server-only.
//
// Why: owner_revenue() only gave the top 8 products by all-time revenue, delivered orders only, with the catalog line price. The new
// women's collection (live since 08.11) has few delivered parcels yet and its free 1+1 piece sits on the line at full price, so it
// never showed. Here:
//   - EVERY product, grouped by category (new collection / watches / men's jewellery / cardholders / leather);
//   - three states: delivered (completed), in motion (shipped), waiting (new + confirmed);
//   - each line gets its REAL share of the order's goods money: (total - shipping) split over the paid lines by catalog value, so the
//     1+1 free piece, set discounts, promo codes and the card discount are already taken off (the sum of the lines = the order's goods);
//   - gift lines (price 0) count as pieces only.
// Romanian orders are in lei and converted at EUR_RON, same as the rest of the tab. Test orders and unpaid card attempts are skipped.
import { adminDb, getAdminSession } from "@/lib/supabase/admin-db";
import { getProductBySlug, allProducts } from "@/lib/products";
import { NEW_COLLECTION_SLUGS } from "@/lib/new-collection";
import { EUR_RON } from "@/lib/ro/config";
import { isUnpaidCardAttempt } from "@/lib/order-status";
import { sofiaDay } from "@/lib/sofia-time";

export type CategoryKey = "collection" | "watches" | "mens_jewellery" | "cardholders" | "leather" | "other";
export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  collection: "Нова колекция (дамски бижута)",
  watches: "Часовници",
  mens_jewellery: "Мъжки бижута",
  cardholders: "Картодържатели",
  leather: "Портфейли и чанти",
  other: "Други",
};
export const CATEGORY_ORDER: CategoryKey[] = ["collection", "watches", "mens_jewellery", "cardholders", "leather", "other"];

export type Cell = { qty: number; revenue: number; orders: number };
export type StateCells = { delivered: Cell; inMotion: Cell; waiting: Cell };
export type ProductRevenueRow = { slug: string; name: string; category: CategoryKey; month: StateCells; all: StateCells };
export type CategoryRevenueRow = { category: CategoryKey; label: string; month: StateCells; all: StateCells };
export type ProductRevenue = {
  monthLabel: string;            // e.g. "11.2026"
  categories: CategoryRevenueRow[];
  products: ProductRevenueRow[];
  totals: { month: StateCells; all: StateCells };
  lastOrderAt: string | null;    // newest real order in the data - shows the numbers are current
};

type Line = { slug?: unknown; name?: unknown; price?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown };
type Row = {
  status: string; total: number | null; shipping_cost: number | null; items: Line[] | null;
  created_at: string; completed_at?: string | null; excluded_from_stock?: boolean | null; ship_country?: string | null;
  payment_method?: string | null; payment_status?: string | null; stripe_payment_intent?: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const qtyOf = (l: Line) => Math.max(1, Math.floor(Number(l.quantity ?? l.qty ?? 1)) || 1);
const cell = (): Cell => ({ qty: 0, revenue: 0, orders: 0 });
const cells = (): StateCells => ({ delivered: cell(), inMotion: cell(), waiting: cell() });
const allBySlug = new Map(allProducts.map((p) => [p.slug, p]));

export function categoryOf(slug: string): CategoryKey {
  if (NEW_COLLECTION_SLUGS.has(slug)) return "collection";
  const p = getProductBySlug(slug) ?? allBySlug.get(slug);
  const c = String(p?.category ?? "");
  if (c === "watches") return "watches";
  if (c === "jewellery" || c === "bracelet" || c === "necklace") return "mens_jewellery";
  if (c === "cardholders") return "cardholders";
  if (c === "wallets" || c === "bags") return "leather";
  if (/^cardholder/.test(slug)) return "cardholders";
  if (/^(wallet|bag|clutch)/.test(slug)) return "leather";
  if (/^(bracelet|necklace)/.test(slug)) return "mens_jewellery";
  if (/watch/.test(slug)) return "watches";
  return "other";
}

const stateOf = (status: string): keyof StateCells | null =>
  status === "completed" ? "delivered" : status === "shipped" ? "inMotion" : status === "new" || status === "confirmed" ? "waiting" : null;

async function fetchRows(): Promise<Row[]> {
  const sb = await adminDb();
  const base = "status, total, shipping_cost, items, created_at, completed_at, excluded_from_stock, ship_country";
  for (const cols of [`${base}, payment_method, payment_status, stripe_payment_intent`, `${base}, payment_method, payment_status`, base]) {
    const out: Row[] = [];
    let failed = false;
    for (let from = 0; from < 50_000; from += 1000) {
      const q = await sb.from("orders").select(cols).in("status", ["completed", "shipped", "new", "confirmed"]).order("created_at").range(from, from + 999);
      if (q.error) { failed = true; break; }
      out.push(...((q.data ?? []) as unknown as Row[]));
      if ((q.data ?? []).length < 1000) break;
    }
    if (!failed) return out;
  }
  return [];
}

/** Owner only (null otherwise). */
export async function getProductRevenue(): Promise<ProductRevenue | null> {
  if ((await getAdminSession())?.role !== "owner") return null;
  const rows = (await fetchRows()).filter((r) => !r.excluded_from_stock && !isUnpaidCardAttempt(r as Parameters<typeof isUnpaidCardAttempt>[0]));

  const month = sofiaDay().slice(0, 7);                        // "2026-11"
  const inMonth = (iso: string | null | undefined) => !!iso && sofiaDay(new Date(iso)).slice(0, 7) === month;

  const prod = new Map<string, ProductRevenueRow>();
  const cat = new Map<CategoryKey, CategoryRevenueRow>();
  const totals = { month: cells(), all: cells() };
  let lastOrderAt: string | null = null;

  for (const r of rows) {
    const st = stateOf(r.status);
    if (!st) continue;
    if (!lastOrderAt || r.created_at > lastOrderAt) lastOrderAt = r.created_at;
    const ro = r.ship_country === "RO";
    const toEur = (n: number) => (ro ? n / EUR_RON : n);
    const lines = Array.isArray(r.items) ? r.items.filter((l) => l && typeof l.slug === "string" && l.slug) : [];
    if (!lines.length) continue;
    const goods = Math.max(0, (Number(r.total) || 0) - (Number(r.shipping_cost) || 0));
    const paidValue = lines.reduce((s, l) => s + (l.gift ? 0 : (Number(l.price) || 0) * qtyOf(l)), 0);
    // delivered -> the month it was delivered; in motion / waiting -> the month it was placed
    const monthHit = inMonth(st === "delivered" ? (r.completed_at ?? r.created_at) : r.created_at);

    const seenProd = new Set<string>();
    const seenCat = new Set<CategoryKey>();
    for (const l of lines) {
      const slug = String(l.slug);
      const q = qtyOf(l);
      const lineValue = l.gift ? 0 : (Number(l.price) || 0) * q;
      const share = paidValue > 0 ? toEur(goods * (lineValue / paidValue)) : 0;
      const c = categoryOf(slug);
      const name = getProductBySlug(slug)?.name ?? allBySlug.get(slug)?.name ?? String(l.name ?? slug).replace(/^ПОДАРЪК:\s*/, "");
      const p = prod.get(slug) ?? { slug, name, category: c, month: cells(), all: cells() };
      const k = cat.get(c) ?? { category: c, label: CATEGORY_LABEL[c], month: cells(), all: cells() };
      const add = (sc: StateCells, firstInOrder: boolean) => {
        sc[st].qty += q; sc[st].revenue += share; if (firstInOrder) sc[st].orders++;
      };
      add(p.all, !seenProd.has(slug)); add(k.all, !seenCat.has(c));
      if (monthHit) { add(p.month, !seenProd.has(slug)); add(k.month, !seenCat.has(c)); }
      seenProd.add(slug); seenCat.add(c);
      prod.set(slug, p); cat.set(c, k);
    }
    const orderGoods = toEur(goods);
    const addTotal = (sc: StateCells) => { sc[st].orders++; sc[st].revenue += orderGoods; sc[st].qty += lines.reduce((s, l) => s + qtyOf(l), 0); };
    addTotal(totals.all);
    if (monthHit) addTotal(totals.month);
  }

  const fix = (sc: StateCells) => { for (const k of ["delivered", "inMotion", "waiting"] as const) sc[k].revenue = round2(sc[k].revenue); };
  for (const p of prod.values()) { fix(p.month); fix(p.all); }
  for (const c of cat.values()) { fix(c.month); fix(c.all); }
  fix(totals.month); fix(totals.all);

  const sum = (sc: StateCells) => sc.delivered.revenue + sc.inMotion.revenue + sc.waiting.revenue;
  return {
    monthLabel: `${month.slice(5, 7)}.${month.slice(0, 4)}`,
    categories: CATEGORY_ORDER.map((c) => cat.get(c)).filter((c): c is CategoryRevenueRow => !!c),
    products: [...prod.values()].sort((a, b) => sum(b.month) - sum(a.month) || sum(b.all) - sum(a.all)),
    totals,
    lastOrderAt,
  };
}
