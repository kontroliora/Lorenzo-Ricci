import { kv } from "@vercel/kv";

export type InventoryMap = Record<string, number>;

const KEY = (slug: string) => `inv:${slug}`;

const DEFAULTS: InventoryMap = {
  "chrono-black": 25,
  "golden-eclipse": 10,
  "polar-frost": 34,
  "bracelet-diamante-cross": 27,
  "bracelet-milano-forte": 24,
  "bracelet-milano-twist": 29,
  "bracelet-signature": 29,
  "necklace-aurelius": 22,
  "necklace-grande-imperiale": 27,
  "necklace-milano-forte": 19,
  "necklace-milano-twist": 27,
  "wallet-alabastro": 10,
  "wallet-rubino": 10,
  "wallet-smeraldo": 0,
  "cardholder-ambra": 15,
  "cardholder-bianco": 15,
  "cardholder-valentina": 15,
  "cardholder-zaffiro": 15,
};

export async function getStock(slug: string): Promise<number> {
  try {
    const val = await kv.get<number>(KEY(slug));
    if (val !== null) return val;
    const seed = DEFAULTS[slug] ?? 0;
    await kv.set(KEY(slug), seed, { nx: true });
    return seed;
  } catch {
    return DEFAULTS[slug] ?? 0;
  }
}

export async function setStock(slug: string, qty: number): Promise<void> {
  await kv.set(KEY(slug), Math.max(0, qty));
}

export async function readInventory(): Promise<InventoryMap> {
  const slugs = Object.keys(DEFAULTS);
  const entries = await Promise.all(
    slugs.map(async (slug) => [slug, await getStock(slug)] as [string, number])
  );
  return Object.fromEntries(entries);
}

export async function decrementStock(slug: string, qty = 1): Promise<number> {
  try {
    const current = await getStock(slug);
    if (current <= 0) return 0;
    const newVal = await kv.decrby(KEY(slug), qty);
    if (newVal < 0) {
      await kv.set(KEY(slug), 0);
      return 0;
    }
    return newVal;
  } catch (err) {
    console.error(`[Inventory] KV error decrementing ${slug}:`, err);
    try { await kv.set(KEY(slug), DEFAULTS[slug] ?? 0); } catch { /* best-effort */ }
    return 0;
  }
}
