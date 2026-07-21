import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY, two authorised surgical actions. Remove after use.
//  A) Deactivate (ban) the koko@ auth account — login rejected, account + role +
//     all 284 audit rows left untouched. Reversible (unban clears ban_duration).
//  B) Fill LR-NHX715's tracking with the AWB Econt can't auto-match (created on a
//     different Econt account), exactly as the panel's "Маркирай изпратена" does.
const TOKEN = "fin7k2m9x";
const KOKO = "koko@lorenzo-ricci.com";
const REF = "LR-NHX715";
const AWB = "5300779561555";
const BAN = "876000h"; // ~100 years

type U = { id: string; email?: string; banned_until?: string | null };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const apply = req.nextUrl.searchParams.get("mode") === "apply";
  const sb = supabaseAdmin();
  const ORD = "order_ref, status, tracking_number, name, total";

  const usersOf = async () => {
    const r = await sb.auth.admin.listUsers();
    return ((r.data?.users ?? []) as U[]).map((u) => ({ email: u.email ?? null, banned_until: u.banned_until ?? null, isKoko: (u.email ?? "").toLowerCase() === KOKO }));
  };
  const auditCount = async () => (await sb.from("order_status_log").select("id", { count: "exact", head: true }).eq("changed_by_email", KOKO)).count ?? 0;

  const before = {
    users: await usersOf(),
    order: (await sb.from("orders").select(ORD).eq("order_ref", REF).single()).data,
    kokoAuditRows: await auditCount(),
  };

  if (!apply) return NextResponse.json({ mode: "inspect", before });

  const result: Record<string, unknown> = {};

  // ── A) ban koko ─────────────────────────────────────────────────────────
  const all = await sb.auth.admin.listUsers();
  const koko = ((all.data?.users ?? []) as U[]).find((u) => (u.email ?? "").toLowerCase() === KOKO);
  if (!koko) {
    result.ban = "koko account not found — skipped";
  } else {
    const r = await sb.auth.admin.updateUserById(koko.id, { ban_duration: BAN });
    result.ban = r.error ? `FAILED: ${r.error.message}` : "banned";
  }

  // ── B) fill the tracking (guarded: only while it has none) ──────────────
  const upd = await sb
    .from("orders")
    .update({ tracking_number: AWB, status: "shipped" })
    .eq("order_ref", REF).is("tracking_number", null)
    .select(ORD);
  result.tracking = upd.error ? `FAILED: ${upd.error.message}` : upd.data?.length ? "filled" : "already had a tracking number — unchanged";

  const after = {
    users: await usersOf(),
    order: (await sb.from("orders").select(ORD).eq("order_ref", REF).single()).data,
    kokoAuditRows: await auditCount(),
  };

  return NextResponse.json({
    mode: "apply",
    result,
    before,
    after,
    checks: {
      kokoBanned: after.users.find((u) => u.isKoko)?.banned_until != null,
      ownerUntouched: after.users.filter((u) => !u.isKoko).every((u) => u.banned_until == null),
      auditPreserved: before.kokoAuditRows === after.kokoAuditRows && after.kokoAuditRows > 0,
    },
  });
}
