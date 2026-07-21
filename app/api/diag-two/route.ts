import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMyAWB, getRawStatuses } from "@/lib/econt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only diagnostics. ZERO writes.
//  A) Koko's account footprint (to plan the access removal safely)
//  B) why AWB 5300779561555 doesn't auto-match order LR-NHX715
const TOKEN = "two7k2m9x";
const KOKO = "koko@lorenzo-ricci.com";
const AWB = "5300779561555";
const REF = "LR-NHX715";

// same normalisation the matcher uses (lib/econt.ts:374)
const normPhone = (p: string) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("359")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
};
const day = (d: number) => new Date(d).toISOString().slice(0, 10);
const toISO = (n: unknown) => { const v = Number(n) || 0; return v ? new Date(v < 1e12 ? v * 1000 : v).toISOString() : null; };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const now = Date.now();

  // ── A) Koko footprint ────────────────────────────────────────────────────
  const users = await sb.auth.admin.listUsers();
  const list = (users.data?.users ?? []) as Array<{ id: string; email?: string; banned_until?: string | null; last_sign_in_at?: string | null; created_at?: string }>;
  const koko = list.find((u) => (u.email ?? "").toLowerCase() === KOKO) ?? null;
  const au = await sb.from("admin_users").select("user_id, role, created_at");
  const kokoRole = (au.data ?? []).find((r) => (r as { user_id: string }).user_id === koko?.id) ?? null;
  const logByUuid = koko ? await sb.from("order_status_log").select("id", { count: "exact", head: true }).eq("changed_by", koko.id) : null;
  const logByEmail = await sb.from("order_status_log").select("id", { count: "exact", head: true }).eq("changed_by_email", KOKO);

  const kokoInfo = {
    accountFound: !!koko,
    userId: koko?.id ?? null,
    createdAt: koko?.created_at ?? null,
    lastSignInAt: koko?.last_sign_in_at ?? null,
    currentlyBanned: koko?.banned_until ?? null,
    adminUsersRole: (kokoRole as { role?: string } | null)?.role ?? "(no admin_users row)",
    auditRowsByUserId: logByUuid?.count ?? 0,
    auditRowsByEmail: logByEmail.count ?? 0,
    allAdminUsers: (au.data ?? []).map((r) => { const x = r as { user_id: string; role: string }; return { role: x.role, isKoko: x.user_id === koko?.id }; }),
    totalAuthUsers: list.length,
  };

  // ── B) tracking match diagnosis ──────────────────────────────────────────
  const od = await sb.from("orders").select("order_ref, status, name, phone, city, address, total, created_at, tracking_number").eq("order_ref", REF).single();
  const o = od.data as { order_ref: string; status: string; name: string; phone: string; city: string; address: string; total: number; created_at: string; tracking_number: string | null } | null;

  // the matcher's exact window: last 14 days, side=sender
  const win14 = await getMyAWB(day(now - 14 * 86_400_000), day(now + 86_400_000), "sender");
  const hit14 = win14.find((a) => a.shipmentNumber === AWB) ?? null;
  // wider window + the other side, to tell "outside window" from "not our shipment"
  const win60 = await getMyAWB(day(now - 60 * 86_400_000), day(now + 86_400_000), "sender");
  const hit60 = win60.find((a) => a.shipmentNumber === AWB) ?? null;
  const recv60 = await getMyAWB(day(now - 60 * 86_400_000), day(now + 86_400_000), "receiver");
  const hitRecv = recv60.find((a) => a.shipmentNumber === AWB) ?? null;

  // does Econt know the parcel at all (public tracking)?
  const raws = await getRawStatuses([AWB]);
  const raw = (raws.get(AWB) ?? null) as Record<string, unknown> | null;

  const prefixes: Record<string, number> = {};
  for (const a of win14) { const p = a.shipmentNumber.slice(0, 4); prefixes[p] = (prefixes[p] ?? 0) + 1; }

  return NextResponse.json({
    A_koko: kokoInfo,
    B_tracking: {
      order: o ? { ...o, phoneNormalised: normPhone(o.phone) } : "(order not found)",
      matcherGates: "status='confirmed' AND tracking IS NULL · AWB from getMyAWB(last 14d, side=sender) · phone match · awb.createdDate >= order.created-12h · |cdAmount-total| <= 2",
      inMatcherWindow_14d_sender: !!hit14,
      inWider_60d_sender: !!hit60,
      inWider_60d_receiver: !!hitRecv,
      awbRowIfFound: hit14 ?? hit60 ?? hitRecv ?? null,
      myAwbCount14d: win14.length,
      myAwbNumberPrefixes14d: prefixes,
      econtPublicTracking: raw
        ? {
            shortDeliveryStatus: raw.shortDeliveryStatus ?? null,
            cdCollectedAmount: raw.cdCollectedAmount ?? null,
            createdTime: toISO(raw.createdTime),
            sendTime: toISO(raw.sendTime),
            senderClient: raw.senderClient ?? null,
            receiverClient: raw.receiverClient ?? null,
            receiverAddress: raw.receiverAddress ?? null,
          }
        : "(Econt returned nothing for this AWB)",
    },
  });
}
