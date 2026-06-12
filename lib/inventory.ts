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
  "cardholder-ambra": 10,
  "cardholder-bianco": 10,
  "cardholder-valentina": 10,
  "cardholder-zaffiro": 10,
};

export async function getStock(slug: string): Promise<number> {
  try {
    const val = await kv.get<number>(KEY(slug));
    if (val !== null) return val;
    const seed = DEFAULTS[slug] ?? 0;
    await kv.set(KEY(slug), seed);
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
    await getStock(slug); // ensure key is seeded before atomic decrement
    const newVal = await kv.decrby(KEY(slug), qty);
    if (newVal < 0) {
      await kv.incrby(KEY(slug), qty);
      return 0;
    }
    return newVal;
  } catch {
    console.error(`[Inventory] KV error decrementing ${slug}`);
    return 0;
  }
}
