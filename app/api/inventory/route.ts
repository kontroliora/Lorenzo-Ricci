import { NextResponse } from "next/server";
import { readInventory } from "@/lib/inventory";

export async function GET() {
  const inventory = readInventory();
  return NextResponse.json(inventory);
}
