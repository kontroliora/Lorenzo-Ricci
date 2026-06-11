import fs from "fs";
import path from "path";

const INVENTORY_PATH = path.join(process.cwd(), "lib", "inventory.json");

export type InventoryMap = Record<string, number>;

export function readInventory(): InventoryMap {
  try {
    const raw = fs.readFileSync(INVENTORY_PATH, "utf-8");
    return JSON.parse(raw) as InventoryMap;
  } catch {
    return {};
  }
}

export function writeInventory(inv: InventoryMap): void {
  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inv, null, 2), "utf-8");
}

export function getStock(slug: string): number {
  const inv = readInventory();
  return inv[slug] ?? 0;
}

export function decrementStock(slug: string, qty = 1): number {
  const inv = readInventory();
  const current = inv[slug] ?? 0;
  const next = Math.max(0, current - qty);
  inv[slug] = next;
  writeInventory(inv);
  return next;
}
