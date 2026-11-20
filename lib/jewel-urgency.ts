// Fake "running low" urgency line for women's jewellery product pages only (owner, 21.11.2026): a
// made-up remaining-count (2-7) and viewer-count (4-15) with no link to the real inventory - that
// still comes from lib/live-stock.ts / /api/stock and decides the real sold-out state. This is
// cosmetic only, shown instead of the real low-stock line while the piece is genuinely in stock.
//
// Scope (owner, 21.11.2026): gold pieces only - that's where the viral-ad traffic lands; silver
// barely sells and has no ads, so it keeps the plain real-stock line instead. And even among gold
// pieces, only about half show the line at all (isJewelUrgencyEligible, a stable per-slug coin
// flip) - every single product reading "running low" at once would look staged.
//
// Persisted in localStorage per slug for a couple of hours, so a customer who orders and comes
// straight back to the same piece sees the number they just "took" off; switching to a different
// piece (the Вид/Камък selectors), or a later visit once the window has passed, gets its own fresh
// random pair.

const TTL_MS = 2 * 60 * 60 * 1000;
const keyOf = (slug: string) => `lr_jewel_urgency:${slug}`;

export interface JewelUrgency {
  stock: number;
  viewers: number;
  ts: number;
}

// A stable (non-random) hash of the slug, so the same piece always lands in the same half - it
// never flickers between "shows it" and "doesn't" across visits or reloads. FNV-1a + a murmur3-style
// finalizer: a plain "h*31+c" accumulator's lowest bit is just the parity of the slug's character
// codes (multiplying by an odd constant never changes a sum's lowest bit), which skewed this badly
// for similar slugs ("-gold" contributing the same parity to every one); the finalizer's shifts mix
// every bit together so %2 is actually close to a coin flip.
function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function isJewelUrgencyEligible(product: { category: string; metal?: "gold" | "silver"; slug: string }): boolean {
  if (product.category !== "jewellery") return false;
  if ((product.metal ?? "gold") !== "gold") return false;
  return hashSlug(product.slug) % 2 === 0;
}

function randomPair(): JewelUrgency {
  return {
    stock: 2 + Math.floor(Math.random() * 6), // 2..7
    viewers: 4 + Math.floor(Math.random() * 12), // 4..15
    ts: Date.now(),
  };
}

export function readJewelUrgency(slug: string): JewelUrgency {
  if (typeof window === "undefined") return randomPair();
  try {
    const raw = window.localStorage.getItem(keyOf(slug));
    if (raw) {
      const parsed = JSON.parse(raw) as JewelUrgency;
      if (Date.now() - parsed.ts < TTL_MS) return parsed;
    }
  } catch {
    // ignore (private mode / blocked storage) - falls through to a fresh pair
  }
  const fresh = randomPair();
  try {
    window.localStorage.setItem(keyOf(slug), JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
}

// Called right after a successful add-to-cart: the number this customer sees for this piece drops by
// one (floored at 1 - "Остава последният брой" takes over instead of reaching 0/"Изчерпан", which
// would contradict the real in-stock state the button above is still showing).
export function decrementJewelUrgency(slug: string, current: JewelUrgency): JewelUrgency {
  const next: JewelUrgency = { stock: Math.max(1, current.stock - 1), viewers: current.viewers, ts: Date.now() };
  try {
    window.localStorage.setItem(keyOf(slug), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
