import { NextRequest, NextResponse } from "next/server";
import { readInventory, setStock } from "@/lib/inventory";

export async function GET() {
  const inventory = await readInventory();
  return NextResponse.json(inventory);
}

export async function PATCH(req: NextRequest) {
  const { slug, quantity } = (await req.json()) as { slug: string; quantity: number };
  if (!slug || typeof quantity !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await setStock(slug, quantity);
  return NextResponse.json({ ok: true, slug, quantity });
}
