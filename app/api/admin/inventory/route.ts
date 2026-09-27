import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Unified inventory (decrement model): wallet_inventory is the single source of
// truth for EVERY product (watches, jewellery, leather). The number here is the
// free-to-sell count. Editing it sets the free-to-sell baseline directly.
export async function GET() {
  const { data, error } = await supabaseAdmin().from("wallet_inventory").select("slug, stock");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const inventory: Record<string, number> = {};
  for (const r of (data ?? []) as { slug: string; stock: number }[]) inventory[r.slug] = Number(r.stock);
  return NextResponse.json(inventory);
}

export async function PATCH(req: NextRequest) {
  const { slug, quantity } = (await req.json()) as { slug: string; quantity: number };
  if (!slug || typeof quantity !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const qty = Math.max(0, Math.floor(quantity));
  const { error } = await supabaseAdmin()
    .from("wallet_inventory")
    .upsert({ slug, stock: qty }, { onConflict: "slug" });
  if (error) {
    console.error("[admin/inventory] wallet_inventory write error:", error.message);
    return NextResponse.json({ ok: false, error: "Наличността не се записа." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug, quantity: qty });
}
