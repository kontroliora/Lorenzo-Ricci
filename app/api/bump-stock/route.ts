// ⚠️ ONE-TIME token-gated migration: +1 sellable stock on every product
// (the employee's 1 sample per product). Idempotent via a KV marker so it can't
// double-apply. Skips wallet-smeraldo (defective, stays 0). DELETE after running.
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { supabase } from "@/lib/supabase";
import { readInventory, setStock } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "bump_samples_9x2kQ";
const MARKER = "bumped:samples:v1";
const SKIP = new Set(["wallet-smeraldo"]);

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const already = await kv.get(MARKER);
  if (already) {
    return NextResponse.json({ alreadyDone: true, note: "+1 вече е приложено веднъж (маркерът съществува) — не се дублира." });
  }

  // ── KV (admin + reservations) ─────────────────────────────────────────────
  const before = await readInventory();
  const kvResult: Record<string, { before: number; after: number }> = {};
  for (const [slug, val] of Object.entries(before)) {
    if (SKIP.has(slug)) { kvResult[slug] = { before: val, after: val }; continue; }
    await setStock(slug, val + 1);
    kvResult[slug] = { before: val, after: val + 1 };
  }
  await kv.set(MARKER, 1);

  // ── wallet_inventory (customer-facing wallets/cardholders) ─────────────────
  let wallet: unknown = null;
  try {
    const { data: rows } = await supabase.from("wallet_inventory").select("slug, stock");
    const out: Array<{ slug: string; before: number; after: number; error: string | null }> = [];
    for (const r of (rows ?? []) as Array<{ slug: string; stock: number }>) {
      if (SKIP.has(r.slug)) continue;
      const { error } = await supabase.from("wallet_inventory").update({ stock: (r.stock ?? 0) + 1 }).eq("slug", r.slug);
      out.push({ slug: r.slug, before: r.stock ?? 0, after: (r.stock ?? 0) + 1, error: error?.message ?? null });
    }
    wallet = out;
  } catch (e) {
    wallet = String(e);
  }

  return NextResponse.json({ ok: true, kv: kvResult, wallet_inventory: wallet });
}
