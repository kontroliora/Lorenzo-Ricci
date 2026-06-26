import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { data, error } = await supabase
    .from("wallet_inventory")
    .select("stock")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ stock: null });
  }
  return NextResponse.json({ stock: data.stock as number });
}
