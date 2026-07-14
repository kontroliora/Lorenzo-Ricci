import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const isLeather = (slug: string) => slug.startsWith("wallet-") || slug.startsWith("cardholder-");
// Same statuses the admin panel counts as "Резервирани".
const RESERVING = ["new", "confirmed", "shipped", "completed"];

// Returns the number AVAILABLE (free to order) — the same "Налични" the admin
// panel shows, so panel and storefront stay in sync:
//   • leather  → wallet_inventory.stock (decrement model)
//   • watches/jewellery → KV physical − reserved (units already in active/
//     completed orders). Reserved is read with the service key (anon can't SELECT
//     orders). Fail-open to the raw KV so a query blip never hides availability.
// NOTE: when the inventory unify (wip/inventory-unify) ships, switch the non-
// leather branch to read wallet_inventory too (single source, post-cutover).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (isLeather(slug)) {
    const { data, error } = await supabase.from("wallet_inventory").select("stock").eq("slug", slug).single();
    if (error || !data) return NextResponse.json({ stock: null });
    return NextResponse.json({ stock: data.stock as number });
  }

  const kv = await getStock(slug);
  let reserved = 0;
  try {
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("items, excluded_from_stock")
      .in("status", RESERVING);
    if (error) console.error("[stock] reserved query error:", error.message);
    for (const o of (data ?? []) as { items: { slug?: string; quantity?: number; qty?: number }[]; excluded_from_stock: boolean }[]) {
      if (o.excluded_from_stock) continue;
      for (const it of o.items ?? []) {
        if (String(it.slug ?? "") === slug) reserved += Math.max(1, Number(it.quantity ?? it.qty ?? 1));
      }
    }
  } catch {
    return NextResponse.json({ stock: kv }); // fail-open
  }
  const available = Math.max(0, kv - reserved);
  if (_req.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json({ stock: available, kv, reserved });
  }
  return NextResponse.json({ stock: available });
}
