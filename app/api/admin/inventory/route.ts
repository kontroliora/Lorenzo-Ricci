import { NextRequest, NextResponse } from "next/server";
import { readInventory, setStock } from "@/lib/inventory";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const inventory = await readInventory();
  return NextResponse.json(inventory);
}

export async function PATCH(req: NextRequest) {
  const { slug, quantity } = (await req.json()) as { slug: string; quantity: number };
  if (!slug || typeof quantity !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const qty = Math.max(0, Math.floor(quantity));
  await setStock(slug, qty);

  // Bridge: leather goods (wallets/cardholders) are served from the
  // wallet_inventory table, NOT KV. Mirror the change there so the panel really
  // controls leather stock. (Setting KV alone silently did nothing on the
  // storefront — that's why Bianco=0 from the panel didn't take effect.)
  if (slug.startsWith("wallet-") || slug.startsWith("cardholder-")) {
    const { error } = await supabaseAdmin()
      .from("wallet_inventory")
      .upsert({ slug, stock: qty }, { onConflict: "slug" });
    if (error) {
      console.error("[admin/inventory] wallet_inventory sync error:", error.message);
      return NextResponse.json({ ok: false, error: "KV е обновен, но wallet_inventory не се синхронизира." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, slug, quantity: qty });
}
