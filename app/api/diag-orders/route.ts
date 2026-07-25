import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY read-only: list recent orders so we can reconcile the inbox against
// the DB (are any emailed orders missing a row?). Owner data, token-guarded; remove.
const TOKEN = "ord7k2m9x";
const qtyOf = (it: { quantity?: number; qty?: number }) => Math.max(1, Number(it?.quantity ?? it?.qty ?? 1));

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString(); // last 60h

  const { data, error } = await sb
    .from("orders")
    .select("order_ref, name, phone, status, total, items, is_manual, excluded_from_stock, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Item = { name?: string; slug?: string; quantity?: number; qty?: number; price?: number };
  type Row = { order_ref: string | null; name: string | null; phone: string | null; status: string; total: number | null; items: Item[]; is_manual: boolean | null; excluded_from_stock: boolean; created_at: string };
  const rows = (data ?? []) as Row[];

  const list = rows.map((o) => ({
    ref: o.order_ref,
    name: o.name,
    phone: o.phone,
    status: o.status,
    total: o.total,
    test: o.excluded_from_stock,
    manual: !!o.is_manual,
    created_sofia: new Date(o.created_at).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    created_at: o.created_at,
    items: (Array.isArray(o.items) ? o.items : []).map((i) => `${i.name ?? i.slug}×${qtyOf(i)}`).join(", "),
  }));

  // Focused check: the two "Николай Йорданов" records (~02:20 / 02:22 on 25.07)
  const nikolai = list.filter((o) => /йорданов/i.test(String(o.name ?? "")));

  return NextResponse.json({ windowFrom: since, totalRecent: list.length, nikolaiYordanov: nikolai, orders: list });
}
