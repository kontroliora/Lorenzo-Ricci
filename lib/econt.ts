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

  const statuses = await getShipmentStatuses(list.map((o) => o.tracking_number));
  const byAwb = new Map(statuses.map((s) => [s.shipmentNumber, s]));

  const now = new Date().toISOString();
  let completed = 0, returned = 0;
  const details: ReconcileResult["details"] = [];

  for (const o of list) {
    const awb = String(o.tracking_number).replace(/\s+/g, "");
    const s = byAwb.get(awb);
    const verdict: EcontVerdict = s ? classify(s) : "unknown";
    details.push({ id: o.id, awb, status: s?.shortDeliveryStatus ?? "—", verdict });

    if (verdict === "delivered") {
      await sb.from("orders").update({ status: "completed", completed_at: now, completed_source: "econt" }).eq("id", o.id);
      completed++;
    } else if (verdict === "returned") {
      await sb.from("orders").update({ status: "returned" }).eq("id", o.id);
      returned++;
    }
  }
  return { checked: list.length, completed, returned, details };
}
