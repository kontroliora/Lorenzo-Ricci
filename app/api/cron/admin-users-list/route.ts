import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { cronAuthorized } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ONE-OFF (owner, 09.11.2026, before rls_lockdown_2_policies.sql): who keeps panel access = every admin_users row, with the
// login e-mail; plus the logins WITHOUT a row (refused by the panel since the RLS code). Logged once, then removed.
const DONE = "admin-users-list:2026-11-09-a";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (await kv.get(DONE)) return NextResponse.json({ ok: true, skipped: "done" });
  const sb = supabaseAdmin();
  const rows = await sb.from("admin_users").select("user_id, role, created_at");
  if (rows.error) return NextResponse.json({ ok: false, error: rows.error.message });
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return NextResponse.json({ ok: false, error: users.error.message });
  const byId = new Map(users.data.users.map((u) => [u.id, u]));
  const admins = (rows.data ?? []).map((r) => ({ email: byId.get(r.user_id)?.email ?? `(no login: ${r.user_id})`, role: r.role, last_sign_in: byId.get(r.user_id)?.last_sign_in_at ?? null }));
  const ids = new Set((rows.data ?? []).map((r) => r.user_id));
  const without = users.data.users.filter((u) => !ids.has(u.id)).map((u) => ({ email: u.email, last_sign_in: u.last_sign_in_at ?? null }));
  const out = { admins, logins_without_admin_row: without };
  console.log("[admin-users-list]", JSON.stringify(out));
  await kv.set(DONE, 1, { ex: 60 * 60 * 24 * 7 });
  return NextResponse.json(out);
}
