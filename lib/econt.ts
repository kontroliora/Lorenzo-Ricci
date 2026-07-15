import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://ee.econt.com/services/Shipments/ShipmentService";

function authHeader(): string {
  const user = process.env.ECONT_USER ?? "";
  const pass = process.env.ECONT_PASS ?? "";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export type EcontStatus = {
  shipmentNumber: string;
  shortDeliveryStatus: string | null;   // "Доставена", "Пътува по линия", "Върната"…
  shortDeliveryStatusEn: string | null;
  deliveryTime: number | null;          // epoch ms — set once delivered
  error: string | null;
};

export type EcontVerdict = "delivered" | "returned" | "in_transit" | "unknown";

export async function getShipmentStatuses(awbs: string[]): Promise<EcontStatus[]> {
  const clean = awbs.map((a) => String(a).replace(/\s+/g, "")).filter(Boolean);
  if (!clean.length) return [];
  const r = await fetch(`${BASE}.getShipmentStatuses.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ shipmentNumbers: clean }),
    cache: "no-store",
  });
  const data = (await r.json()) as {
    shipmentStatuses?: Array<{ status: Record<string, unknown> | null; error: { message?: string } | null }>;
  };
  return (data.shipmentStatuses ?? []).map((s) => {
    const st = (s.status ?? {}) as Record<string, unknown>;
    return {
      shipmentNumber: String(st.shipmentNumber ?? ""),
      shortDeliveryStatus: (st.shortDeliveryStatus as string) ?? null,
      shortDeliveryStatusEn: (st.shortDeliveryStatusEn as string) ?? null,
      deliveryTime: (st.deliveryTime as number) ?? null,
      error: s.error?.message ?? null,
    };
  });
}

// DEBUG (Stage 1 research): return the COMPLETE raw getShipmentStatuses payload,
// unmapped — so we can inspect every structured field (office codes/types, event
// history, flags, deliveryTime) and find which ones reliably distinguish a
// transit office from the recipient's final office / "available for pickup".
export async function getShipmentStatusesRaw(awbs: string[]): Promise<unknown> {
  const clean = awbs.map((a) => String(a).replace(/\s+/g, "")).filter(Boolean);
  if (!clean.length) return { shipmentStatuses: [] };
  const r = await fetch(`${BASE}.getShipmentStatuses.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ shipmentNumbers: clean }),
    cache: "no-store",
  });
  return await r.json();
}

// ── Structured analysis of a raw getShipmentStatuses object (Stage 1 fields) ──
// All decisions use structured, code-based fields — never office-name text.
type RawEvent = { destinationType?: string; officeCode?: string | null; time?: number; officeName?: string };
type RawStatus = {
  shipmentNumber?: string;
  sendTime?: number | null;          // set ONLY when Econt physically accepts the parcel
  deliveryTime?: number | null;      // set on delivery
  cdCollectedTime?: number | null;   // set when COD is collected
  receiverDeliveryType?: string;     // "office" | "door"
  receiverOfficeCode?: string | null;
  storageOfficeName?: string | null; // where the parcel currently sits — the office name to tell the customer
  deliveryAttemptCount?: number | null;
  shortDeliveryStatus?: string | null;
  trackingEvents?: RawEvent[];
};

export type ShipmentAnalysis = {
  accepted: boolean;                 // Econt physically took it (sendTime != null) — Email 1 gate
  shippedAtMs: number | null;        // = sendTime
  delivered: boolean;                // never remind
  returned: boolean;                 // completed return ("върната" in status text)
  returning: boolean;                // heading back to sender (in progress) OR returned — Email 1 must never call this "on its way"
  deliveryType: string;              // "office" | "door"
  atFinalOffice: boolean;            // at recipient's final office AND not collected
  arrivedAtFinalOfficeMs: number | null; // count the 4-5 days from HERE, not from ship date
  deliveryAttemptCount: number;      // >0 → a failed door attempt (parcel parked at office)
  officeName: string;                // storageOfficeName → final-office event name → "" (for the reminder)
};

const FINAL_OFFICE_TYPES = new Set(["in_delivery_office", "in_pickup_office"]);
// Return-to-sender events (in progress OR completed) — the reliable signal that
// a parcel is no longer heading to the customer. Shared by analyzeShipment (the
// Email-1 gate) and classifyReturn (the uncollected/refused split).
const RETURN_EVENT_TYPES = new Set(["returned_to_sender", "is_returning_to_sender"]);

export function analyzeShipment(raw: unknown): ShipmentAnalysis {
  const s = (raw ?? {}) as RawStatus;
  const events = Array.isArray(s.trackingEvents) ? s.trackingEvents : [];
  const roc = s.receiverOfficeCode == null ? null : String(s.receiverOfficeCode);
  const lastType = events.length ? events[events.length - 1]?.destinationType : null;

  const delivered = s.deliveryTime != null || s.cdCollectedTime != null || lastType === "client";
  const returned = String(s.shortDeliveryStatus ?? "").toLowerCase().includes("върната");
  // Robust "heading back to sender" check: any return event in the history, OR
  // the completed-return text. Catches is_returning_to_sender (in progress),
  // which the "върната" text alone misses — the LR-K2Y30V email-after-return bug.
  const returning = returned || events.some((e) => RETURN_EVENT_TYPES.has(e?.destinationType ?? ""));

  // First arrival at the recipient's FINAL office (structural: type ∈ final-set
  // AND officeCode === receiverOfficeCode). Transit offices/hubs have other codes.
  let arrivedAtFinalOfficeMs: number | null = null;
  let finalOfficeName = "";
  for (const e of events) {
    if (FINAL_OFFICE_TYPES.has(e?.destinationType ?? "") && e?.officeCode != null && roc != null && String(e.officeCode) === roc) {
      arrivedAtFinalOfficeMs = Number(e.time) || null;
      finalOfficeName = String(e.officeName ?? "");
      break;
    }
  }
  // Which office to name in the reminder: the live storage location first, then
  // the final-office event name, else empty (template omits the name gracefully).
  const officeName = String(s.storageOfficeName ?? "").trim() || finalOfficeName || "";

  return {
    accepted: s.sendTime != null,
    shippedAtMs: s.sendTime != null ? Number(s.sendTime) : null,
    delivered,
    returned,
    returning,
    deliveryType: String(s.receiverDeliveryType ?? ""),
    atFinalOffice: arrivedAtFinalOfficeMs != null && !delivered && !returned,
    arrivedAtFinalOfficeMs,
    deliveryAttemptCount: Number(s.deliveryAttemptCount ?? 0) || 0,
    officeName,
  };
}

// ── Return classification ────────────────────────────────────────────────────
// Econt gives NO explicit reason code — a return reads identically whether the
// parcel expired in storage or the customer refused it (destinationType
// returned_to_sender / is_returning_to_sender, detail "Връщане на пратката",
// lastProcessedInstruction "return"). rejectReturnParcelPaySide is a per-shipment
// CONFIG (set even on delivered parcels), not who actually paid. The reliable
// signal is DWELL at the recipient's final office: uncollected parcels sit the
// full ~7-working-day storage window (≈8-9 calendar days) before auto-returning;
// refused ones come back in 1-2 days. A door delivery with failed attempts and
// no contact is treated as uncollected too.
export const RETURN_UNCOLLECTED_DAYS = 6; // calendar-day dwell threshold (configurable)

export type ReturnKind = "uncollected" | "refused" | "unknown";

export function classifyReturn(raw: RawStatus): { kind: ReturnKind; dwellDays: number | null } {
  const events = Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
  const roc = raw.receiverOfficeCode == null ? null : String(raw.receiverOfficeCode);

  let arrivedMs: number | null = null;   // first arrival at the recipient's FINAL office
  let returnMs: number | null = null;    // when it started heading back
  for (const e of events) {
    if (arrivedMs == null && FINAL_OFFICE_TYPES.has(e?.destinationType ?? "") && e?.officeCode != null && roc != null && String(e.officeCode) === roc) {
      arrivedMs = Number(e.time) || null;
    }
    if (returnMs == null && RETURN_EVENT_TYPES.has(e?.destinationType ?? "")) {
      returnMs = Number(e.time) || null;
    }
  }

  let dwellDays: number | null = null;
  if (arrivedMs != null && returnMs != null && returnMs >= arrivedMs) {
    dwellDays = Math.round(((returnMs - arrivedMs) / 86_400_000) * 10) / 10;
  }

  const doorFailed = String(raw.receiverDeliveryType ?? "") === "door" && (Number(raw.deliveryAttemptCount ?? 0) || 0) > 0;

  let kind: ReturnKind = "unknown";
  if (dwellDays != null) kind = dwellDays >= RETURN_UNCOLLECTED_DAYS ? "uncollected" : "refused";
  else if (doorFailed) kind = "uncollected";

  return { kind, dwellDays };
}

// Verdict straight from a raw status (delivered / returned / in_transit).
function rawVerdict(raw: RawStatus): EcontVerdict {
  const bg = String(raw.shortDeliveryStatus ?? "").toLowerCase();
  const events = Array.isArray(raw.trackingEvents) ? raw.trackingEvents : [];
  const lastType = events.length ? events[events.length - 1]?.destinationType : null;
  if (bg.includes("върната") || RETURN_EVENT_TYPES.has(lastType ?? "")) return "returned";
  if (raw.deliveryTime != null || raw.cdCollectedTime != null || bg === "доставена" || lastType === "client") return "delivered";
  if (raw.shortDeliveryStatus) return "in_transit";
  return "unknown";
}

// Persist a return with its auto-classification, resilient to a missing migration
// (falls back to updating just the status so a return is never dropped).
async function markReturnedWithKind(sb: SupabaseClient, id: number, kind: ReturnKind, dwellDays: number | null): Promise<void> {
  let { error } = await sb.from("orders").update({ status: "returned", return_kind: kind, return_dwell_days: dwellDays }).eq("id", id);
  if (error && /return_kind|return_dwell_days|column|schema cache/i.test(error.message)) {
    ({ error } = await sb.from("orders").update({ status: "returned" }).eq("id", id));
  }
  if (error) console.error("[econt] mark returned error:", error.message);
}

// Backfill return_kind for orders already marked returned but not yet classified
// (e.g. the 2 historical returns, or manual markReturned).
export async function classifyExistingReturns(sb: SupabaseClient): Promise<number> {
  const { data } = await sb
    .from("orders")
    .select("id, tracking_number, return_kind")
    .eq("status", "returned")
    .not("tracking_number", "is", null);
  const rows = ((data ?? []) as { id: number; tracking_number: string; return_kind: string | null }[])
    .filter((o) => !o.return_kind);
  if (!rows.length) return 0;
  const rawMap = await getRawStatuses(rows.map((o) => o.tracking_number));
  let done = 0;
  for (const o of rows) {
    const raw = rawMap.get(String(o.tracking_number).replace(/\s+/g, ""));
    if (!raw) continue;
    const { kind, dwellDays } = classifyReturn(raw);
    await markReturnedWithKind(sb, o.id, kind, dwellDays);
    done++;
  }
  return done;
}

// awb → raw status object, for the cron / tracking page.
export async function getRawStatuses(awbs: string[]): Promise<Map<string, RawStatus>> {
  const data = (await getShipmentStatusesRaw(awbs)) as { shipmentStatuses?: Array<{ status: RawStatus | null }> };
  const map = new Map<string, RawStatus>();
  for (const x of data.shipmentStatuses ?? []) {
    const num = x.status?.shipmentNumber;
    if (x.status && num) map.set(String(num).replace(/\s+/g, ""), x.status);
  }
  return map;
}

// Check "върната" BEFORE "доставена": a returned parcel reads "Върната и
// доставена към подател" — it contains both words, but it's a return.
export function classify(s: EcontStatus): EcontVerdict {
  const bg = (s.shortDeliveryStatus ?? "").toLowerCase();
  const en = (s.shortDeliveryStatusEn ?? "").toLowerCase();
  if (bg.includes("върната") || en.includes("returned")) return "returned";
  if (s.deliveryTime != null || bg === "доставена" || en === "delivered") return "delivered";
  if (s.shortDeliveryStatus) return "in_transit";
  return "unknown";
}

export type ReconcileResult = {
  checked: number;
  completed: number;
  returned: number;
  details: Array<{ id: number; awb: string; status: string; verdict: EcontVerdict }>;
};

// Reads shipped orders via the given client, asks Econt, and transitions:
//   delivered → completed (completed_source='econt' — triggers the bonus)
//   returned  → returned
// Works with either an authenticated (manual button) or service-role (cron) client.
export async function reconcileShippedOrders(sb: SupabaseClient): Promise<ReconcileResult> {
  const { data, error } = await sb
    .from("orders")
    .select("id, tracking_number")
    .eq("status", "shipped")
    .not("tracking_number", "is", null);
  if (error) throw new Error(error.message);

  const list = (data ?? []) as Array<{ id: number; tracking_number: string }>;
  if (!list.length) return { checked: 0, completed: 0, returned: 0, details: [] };

  // Raw statuses — we need the tracking events to classify returns (dwell).
  const rawMap = await getRawStatuses(list.map((o) => o.tracking_number));

  const now = new Date().toISOString();
  let completed = 0, returned = 0;
  const details: ReconcileResult["details"] = [];

  for (const o of list) {
    const awb = String(o.tracking_number).replace(/\s+/g, "");
    const raw = rawMap.get(awb);
    const verdict: EcontVerdict = raw ? rawVerdict(raw) : "unknown";
    details.push({ id: o.id, awb, status: raw?.shortDeliveryStatus ?? "—", verdict });

    if (verdict === "delivered") {
      await sb.from("orders").update({ status: "completed", completed_at: now, completed_source: "econt" }).eq("id", o.id);
      completed++;
    } else if (verdict === "returned" && raw) {
      const { kind, dwellDays } = classifyReturn(raw);
      await markReturnedWithKind(sb, o.id, kind, dwellDays);
      returned++;
    }
  }
  return { checked: list.length, completed, returned, details };
}

// ── Tracking auto-fill (Method 2 — FIND, never create) ───────────────────────
// Pull my shipments from Econt (getMyAWB) and match them to confirmed orders
// that still have no tracking number, by phone + amount + date.

export type MyAWB = { shipmentNumber: string; receiverPhone: string; cdAmount: number; createdDate: number; status: string };

// Normalize a BG phone to its 9-digit core (drops +359 / leading 0 / spaces).
function normPhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("359")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

export async function getMyAWB(dateFrom: string, dateTo: string, side = "sender"): Promise<MyAWB[]> {
  const auth = authHeader();
  const out: MyAWB[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`${BASE}.getMyAWB.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ dateFrom, dateTo, page, side }),
      cache: "no-store",
    });
    const data = (await r.json()) as { results?: Array<Record<string, unknown>>; totalPages?: number };
    for (const x of data.results ?? []) {
      out.push({
        shipmentNumber: String(x.shipmentNumber ?? ""),
        receiverPhone: String(x.receiverPhone ?? ""),
        cdAmount: Number(x.cdAmount ?? 0),
        createdDate: Number(x.createdDate ?? 0),
        status: String(x.status ?? ""),
      });
    }
    if (page >= (data.totalPages ?? 1)) break;
  }
  return out;
}

export type MatchCandidate = { awb: string; cdAmount: number; status: string; createdDate: number };
export type MatchResult = {
  scanned: number;
  autoFilled: Array<{ orderId: number; ref: string | null; name: string | null; awb: string }>;
  pending: Array<{ orderId: number; ref: string | null; name: string | null; phone: string | null; total: number; candidates: MatchCandidate[] }>;
};

export async function matchTrackingNumbers(sb: SupabaseClient): Promise<MatchResult> {
  const { data: ordersData, error } = await sb
    .from("orders")
    .select("id, order_ref, name, phone, total, subtotal, created_at")
    .eq("status", "confirmed")
    .is("tracking_number", null);
  if (error) throw new Error(error.message);
  const orders = (ordersData ?? []) as Array<{ id: number; order_ref: string | null; name: string | null; phone: string | null; total: number | null; subtotal: number | null; created_at: string }>;
  if (!orders.length) return { scanned: 0, autoFilled: [], pending: [] };

  // AWBs already assigned anywhere → never reuse.
  const { data: usedData } = await sb.from("orders").select("tracking_number").not("tracking_number", "is", null);
  const usedAwbs = new Set((usedData ?? []).map((r) => String((r as { tracking_number: unknown }).tracking_number).replace(/\s+/g, "")));

  const now = Date.now();
  const day = (d: number) => new Date(d).toISOString().slice(0, 10);
  const awbs = await getMyAWB(day(now - 14 * 86_400_000), day(now + 86_400_000), "sender");

  const byPhone = new Map<string, MyAWB[]>();
  for (const a of awbs) {
    if (usedAwbs.has(a.shipmentNumber)) continue;
    const p = normPhone(a.receiverPhone);
    if (!p) continue;
    const arr = byPhone.get(p) ?? [];
    arr.push(a);
    byPhone.set(p, arr);
  }

  const autoFilled: MatchResult["autoFilled"] = [];
  const pending: MatchResult["pending"] = [];
  const claimed = new Set<string>();

  for (const o of orders) {
    const p = normPhone(o.phone ?? "");
    if (!p) continue;
    const orderCreated = new Date(o.created_at).getTime();
    const cands = (byPhone.get(p) ?? []).filter(
      (a) => !claimed.has(a.shipmentNumber) && a.createdDate >= orderCreated - 12 * 3_600_000,
    );
    if (!cands.length) continue;

    const total = Number(o.total ?? 0);
    const subtotal = Number(o.subtotal ?? 0);
    const amountOk = (v: number) => Math.abs(v - total) <= 2 || (subtotal > 0 && Math.abs(v - subtotal) <= 2);

    if (cands.length === 1 && amountOk(cands[0].cdAmount)) {
      const awb = cands[0].shipmentNumber;
      claimed.add(awb);
      await sb.from("orders").update({ tracking_number: awb, status: "shipped" }).eq("id", o.id);
      autoFilled.push({ orderId: o.id, ref: o.order_ref, name: o.name, awb });
    } else {
      pending.push({
        orderId: o.id, ref: o.order_ref, name: o.name, phone: o.phone, total,
        candidates: cands.map((a) => ({ awb: a.shipmentNumber, cdAmount: a.cdAmount, status: a.status, createdDate: a.createdDate })),
      });
    }
  }
  return { scanned: orders.length, autoFilled, pending };
}
