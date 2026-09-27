import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Unified inventory (decrement model): every product's "Налично" = the free-to-
// sell count in wallet_inventory.stock — dropped atomically at order time and put
// back on cancel / restocked-return. Same number the admin panel shows, so panel
// and storefront stay in sync. anon can SELECT wallet_inventory (public stock).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data, error } = await supabase.from("wallet_inventory").select("stock").eq("slug", slug).single();
  if (error || !data) return NextResponse.json({ stock: null });
  return NextResponse.json({ stock: data.stock as number });
}
