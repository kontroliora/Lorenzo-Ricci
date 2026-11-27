// SERVER ONLY. Некоректни клиенти: the risk of every customer on a page, in ONE database call (no N+1).
//   1st choice: the RPC customer_risk_many(phones[]) (supabase/customer_risk.sql) - indexed on lr_norm_phone(phone).
//   Fallback (the SQL not run yet / RPC error): ONE read of every return + delivery, grouped here with the same phone rule,
//   so the badge is right even before the migration (manual flags and external checks need the migration's tables).
// Never throws: a problem here must never take the orders page down.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normPhone, type CustomerRisk, type RiskIncident } from "./customer-risk-shared";
import { RETURN_STATUSES } from "./order-status";

type RpcRow = {
  input_phone: string; phone_norm: string; uncollected: number; refused: number; returned_other: number; completed: number;
  last_incident_at: string | null; incidents: RiskIncident[] | null; manual_flag: boolean; manual_note: string | null; manual_by: string | null;
  manual_at: string | null; ext_reports: number | null; ext_checked_at: string | null; ext_error: string | null; ext_error_at: string | null;
};

const fromRpc = (r: RpcRow): CustomerRisk => ({
  phone: r.phone_norm,
  uncollected: r.uncollected ?? 0,
  refused: r.refused ?? 0,
  returnedOther: r.returned_other ?? 0,
  completed: r.completed ?? 0,
  lastIncidentAt: r.last_incident_at,
  incidents: Array.isArray(r.incidents) ? r.incidents : [],
  manual: r.manual_at || r.manual_flag ? { flagged: !!r.manual_flag, note: r.manual_note, by: r.manual_by, at: r.manual_at } : null,
  external: r.ext_checked_at || r.ext_error_at ? { reports: r.ext_reports, checkedAt: r.ext_checked_at, error: r.ext_error, errorAt: r.ext_error_at } : null,
});

/** Risk keyed by the phone EXACTLY as the caller passed it (so `risk[order.phone]` works). Phones nobody can read are left out. */
export async function getRiskMap(sb: SupabaseClient, phones: (string | null | undefined)[]): Promise<Record<string, CustomerRisk>> {
  const uniq = [...new Set(phones.map((p) => String(p ?? "").trim()).filter((p) => normPhone(p)))];
  if (!uniq.length) return {};
  try {
    const out: Record<string, CustomerRisk> = {};
    // one call per 1000 phones (the orders page loads up to 1000 orders -> one call)
    for (let i = 0; i < uniq.length; i += 1000) {
      const { data, error } = await sb.rpc("customer_risk_many", { p_phones: uniq.slice(i, i + 1000) });
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as RpcRow[]) out[r.input_phone] = fromRpc(r);
    }
    return out;
  } catch (e) {
    console.warn("[risk] customer_risk_many unavailable, computing from orders:", e instanceof Error ? e.message : e);
    return fallbackRisk(sb, uniq).catch((err) => {
      console.error("[risk] fallback failed:", err instanceof Error ? err.message : err);
      return {};
    });
  }
}

type OrderRow = { id: number; order_ref: string | null; phone: string | null; status: string; return_kind?: string | null; returning_at?: string | null; restocked_at?: string | null; created_at: string; source_site?: string | null; excluded_from_stock?: boolean | null };

async function fallbackRisk(sb: SupabaseClient, phones: string[]): Promise<Record<string, CustomerRisk>> {
  const want = new Set(phones.map((p) => normPhone(p)!));
  const rows: OrderRow[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await sb.from("orders").select("*").in("status", ["completed", ...RETURN_STATUSES]).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as OrderRow[]));
    if (!data || data.length < 1000) break;
  }
  const byNorm = new Map<string, CustomerRisk>();
  for (const o of rows) {
    const n = normPhone(o.phone);
    if (!n || !want.has(n) || o.excluded_from_stock) continue;
    const r = byNorm.get(n) ?? { phone: n, uncollected: 0, refused: 0, returnedOther: 0, completed: 0, lastIncidentAt: null, incidents: [], manual: null, external: null };
    if (o.status === "completed") r.completed++;
    else {
      const kind = o.return_kind === "uncollected" || o.return_kind === "refused" ? o.return_kind : "returned";
      if (kind === "uncollected") r.uncollected++; else if (kind === "refused") r.refused++; else r.returnedOther++;
      const at = o.returning_at ?? o.restocked_at ?? o.created_at;
      r.incidents.push({ id: o.id, ref: o.order_ref, kind, at, site: o.source_site ?? null });
      if (!r.lastIncidentAt || Date.parse(at) > Date.parse(r.lastIncidentAt)) r.lastIncidentAt = at;
    }
    byNorm.set(n, r);
  }
  const out: Record<string, CustomerRisk> = {};
  for (const p of phones) {
    const n = normPhone(p)!;
    const r = byNorm.get(n);
    if (r) { r.incidents.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); out[p] = r; }
  }
  return out;
}
