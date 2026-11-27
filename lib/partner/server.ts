import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "../supabase-admin";
import { COLLECTION_PIECES } from "../new-collection";
import { NEW_COLLECTION_PRODUCTS } from "../new-collection-products";
import { applyOverride, getPriceOverrides } from "../price-overrides";
import { kv } from "@vercel/kv";
import { analyzeShipment, getRawStatuses } from "../econt";
import type { PartnerHistoryRow } from "./orders";
import { getRiskMap } from "../customer-risk";
import { riskLevel, internalReason, externalReason } from "../customer-risk-shared";
import { PARTNER_COOKIE, partnerFromCookie, type Partner } from "./access";
import { pickupInfoOf, type PickupFacts } from "./pickup";
import {
  PARTNER_FILTERS, PARTNER_ORDER_COLUMNS, PARTNER_SINCE, matchesFilter, partnerDuplicates, partnerView, partnerVisible, pieceInfo,
  type PartnerFilter, type PartnerOrderView,
} from "./orders";

// Server side of /partner (service role, AFTER the partner checks). Every route of /api/partner calls requirePartner() first.

export const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
export const noStore = { "Cache-Control": "no-store, private" };

/** The enabled partner of this request, or a 403 response (no / bad / expired / revoked cookie, or disabled). */
export async function requirePartner(req: NextRequest): Promise<Partner | NextResponse> {
  const p = await partnerFromCookie(req.cookies.get(PARTNER_COOKIE)?.value);
  return p ?? forbidden();
}

type Row = Record<string, unknown>;

/** One order he may see (by reference), with his state; null when it is not his (not jewellery, unpaid card, unknown). */
export async function partnerOrderRow(ref: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin().from("orders").select(PARTNER_ORDER_COLUMNS).eq("order_ref", ref).maybeSingle();
  if (error) throw new Error(error.message);
  return data && partnerVisible(data as Row) ? (data as Row) : null;
}

export async function listPartnerOrders(filter: PartnerFilter): Promise<{ orders: PartnerOrderView[]; counts: Record<PartnerFilter, number> }> {
  const sb = supabaseAdmin();
  const rows: Row[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    // id + email + excluded_from_stock are read ONLY to find repeat orders (partnerDuplicates); partnerView never copies them
    const { data, error } = await sb.from("orders").select(`${PARTNER_ORDER_COLUMNS}, id, email, excluded_from_stock`)
      .gte("created_at", PARTNER_SINCE).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  // orders the owner marked "не е дубликат" (column from supabase/orders_duplicates.sql: a missing column just means none)
  try {
    const dis = await sb.from("orders").select("order_ref").not("duplicate_dismissed_at", "is", null).gte("created_at", PARTNER_SINCE);
    if (!dis.error) { const ds = new Set((dis.data ?? []).map((d) => String((d as Row).order_ref))); for (const r of rows) if (ds.has(String(r.order_ref))) r.duplicate_dismissed_at = "x"; }
  } catch { /* optional */ }
  const dups = partnerDuplicates(rows);
  const mine = rows.filter(partnerVisible);
  const refs = mine.map((r) => String(r.order_ref));
  const states = new Map<string, Row>();
  for (let i = 0; i < refs.length; i += 200) {
    const { data, error } = await sb.from("partner_order_state").select("order_ref, status, note, updated_at").in("order_ref", refs.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const s of (data ?? []) as Row[]) states.set(String(s.order_ref), s);
  }
  const facts = await econtFacts(mine.filter((r) => r.status === "shipped" && r.tracking_number).map((r) => String(r.tracking_number)));
  const all = mine.map((r) => {
    const v = partnerView(r, states.get(String(r.order_ref)) as never, dups.get(String(r.order_ref)));
    if (r.status === "shipped" && r.tracking_number) v.pickup = pickupInfoOf(facts.get(awbOf(r.tracking_number)));
    return v;
  });
  await attachHistory(sb, mine, all);
  // НЕКОРЕКТЕН / ВНИМАНИЕ badge (owner 27.11.2026): the level and the short reason only - no links to other orders, no notes.
  try {
    const risk = await getRiskMap(sb, mine.map((r) => String(r.phone ?? "")));
    mine.forEach((r, i) => {
      const k = risk[String(r.phone ?? "").trim()];
      const level = riskLevel(k);
      if (k && level) all[i].risk = { level, reason: [internalReason(k), externalReason(k), k.manual?.flagged ? "маркиран от магазина" : ""].filter(Boolean).join(" · ") };
    });
  } catch (e) { console.error("[partner] risk unavailable:", e instanceof Error ? e.message : e); }
  const counts = Object.fromEntries(PARTNER_FILTERS.map((f) => [f, all.filter((o) => matchesFilter(o.real.key, f, o.pickup)).length])) as Record<PartnerFilter, number>;
  return { orders: all.filter((o) => matchesFilter(o.real.key, filter, o.pickup)), counts };
}

const awbOf = (t: unknown) => String(t ?? "").replace(/\s+/g, "");
const FACTS_TTL_S = 60 * 60;   // Econt is asked at most once an hour per parcel (the page refreshes every 20 s)

/** Econt facts (at the office? since when? collected? returning?) per tracking number, cached in KV for an hour. Never throws. */
async function econtFacts(trackings: string[]): Promise<Map<string, PickupFacts>> {
  const out = new Map<string, PickupFacts>();
  const awbs = [...new Set(trackings.map(awbOf).filter(Boolean))];
  if (!awbs.length) return out;
  try {
    const cached = await kv.mget<(PickupFacts | null)[]>(...awbs.map((a) => `partner-pickup:${a}`));
    const missing: string[] = [];
    awbs.forEach((a, i) => (cached[i] ? out.set(a, cached[i] as PickupFacts) : missing.push(a)));
    for (let i = 0; i < missing.length; i += 50) {
      const raw = await getRawStatuses(missing.slice(i, i + 50));
      for (const [awb, st] of raw) {
        const a = analyzeShipment(st);
        const f: PickupFacts = { delivered: a.delivered, returning: a.returning, atFinalOffice: a.atFinalOffice, arrivedAtFinalOfficeMs: a.arrivedAtFinalOfficeMs, officeName: a.officeName };
        out.set(awb, f);
        await kv.set(`partner-pickup:${awb}`, f, { ex: FACTS_TTL_S });
      }
    }
  } catch (e) { console.error("[partner] Econt status unavailable:", e instanceof Error ? e.message : e); }
  return out;
}

export type PartnerPiece = { slug: string; model: string; color: string; stone: string; sku: string; image: string; price: number; stock: number | null; onSale: boolean };

/** The read-only "Бижута" list: every women's piece with photo, price (incl. a price override) and current stock. */
export async function partnerPieces(): Promise<PartnerPiece[]> {
  const [overrides, inv] = await Promise.all([
    getPriceOverrides().catch(() => new Map()),
    supabaseAdmin().from("wallet_inventory").select("slug, stock").in("slug", COLLECTION_PIECES.map((p) => p.slug)),
  ]);
  const stock = new Map(((inv.data ?? []) as { slug: string; stock: number }[]).map((r) => [r.slug, r.stock]));
  return COLLECTION_PIECES.map((p) => {
    const base = NEW_COLLECTION_PRODUCTS.find((x) => x.slug === p.slug)!;
    const product = applyOverride(base, overrides);
    const info = pieceInfo(p.slug)!;
    return {
      slug: p.slug, model: info.model, color: info.color, stone: info.stone, sku: info.sku,
      image: product.images?.[0]?.src ?? product.coverImage?.src ?? "/logo.webp",
      price: product.price, stock: stock.has(p.slug) ? Number(stock.get(p.slug)) : null, onSale: !product.hidden,
    };
  });
}

// ── History on his orders (owner, 27.11.2026) ───────────────────────────────
// The shop's history rows (order_status_log: status, calls, label) + his own marks (partner_status_log), only for the orders he may
// see (`mine` is already cut by partnerVisible). The text of an internal comment, fake-marks and print rows are not copied.
const HIDDEN_FOR_PARTNER = new Set(["маркиране", "печат", "върната стока", "некоректен", "nekorekten"]);   // he sees the НЕКОРЕКТЕН badge, not our notes
async function attachHistory(sb: ReturnType<typeof supabaseAdmin>, mine: Row[], views: PartnerOrderView[]): Promise<void> {
  try {
    const { whoName, actionText, PARTNER_NAME } = await import("../admin-names");
    const byRef = new Map(views.map((v) => [v.ref, v]));
    const refById = new Map(mine.map((r) => [Number((r as { id?: number }).id), String(r.order_ref)]));
    const ids = [...refById.keys()].filter((n) => Number.isFinite(n));
    const push = (ref: string, row: PartnerHistoryRow) => { const v = byRef.get(ref); if (v) (v.history ??= []).push(row); };
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await sb.from("order_status_log").select("order_id, old_status, new_status, changed_by_email, changed_at").in("order_id", ids.slice(i, i + 300));
      for (const r of (data ?? []) as { order_id: number; old_status: string | null; new_status: string | null; changed_by_email: string | null; changed_at: string }[]) {
        if (HIDDEN_FOR_PARTNER.has(r.old_status ?? "")) continue;
        const text = r.old_status === "коментар" ? "Коментар" : actionText(r);
        push(refById.get(r.order_id) ?? "", { text, who: whoName(r.changed_by_email), at: r.changed_at });
      }
    }
    const refs = [...byRef.keys()];
    const WORD: Record<string, string> = { new: "без отметка", called: "Обадено", confirmed: "Потвърдена (партньор)", cancelled: "Отказана (партньор)", no_answer: "Не вдига (партньор)" };
    for (let i = 0; i < refs.length; i += 300) {
      const { data } = await sb.from("partner_status_log").select("order_ref, old_status, new_status, changed_at").in("order_ref", refs.slice(i, i + 300));
      for (const r of (data ?? []) as { order_ref: string; old_status: string | null; new_status: string | null; changed_at: string }[]) {
        push(r.order_ref, { text: r.new_status !== r.old_status ? WORD[r.new_status ?? ""] ?? String(r.new_status) : "Бележка", who: PARTNER_NAME, at: r.changed_at });
      }
    }
    for (const v of views) v.history?.sort((a, b) => a.at.localeCompare(b.at));
  } catch (e) {
    console.error("[partner] history unavailable:", e instanceof Error ? e.message : e);   // the list still works without it
  }
}
