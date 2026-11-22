// Fake "running low" urgency line for women's jewellery product pages only (owner, 21.11.2026): a
// made-up remaining-count (mostly 3-5, occasionally 6 - see randomStock) and viewer-count (4-15),
// with no link to the real inventory - that
// still comes from lib/live-stock.ts / /api/stock and decides the real sold-out state. This is
// cosmetic only, shown instead of the real low-stock line while the piece is genuinely in stock.
//
// Scope: ALL gold jewellery (owner, 22.11.2026) - the classic line (always gold, no silver variant)
// and every gold piece of the 2026 collection, 17 pieces in all. Silver is about half of its 9
// pieces (owner, 22.11.2026), picked by a stable per-slug coin flip (hashSlug below) rather than a
// named list - every silver piece showing it at once would look staged. Silver's split is the only
// thing still held back; gold shows it everywhere since that's where the ad traffic goes.
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

// A stable (non-random) hash of the slug, so the same silver piece always lands in the same half -
// it never flickers between "shows it" and "doesn't" across visits or reloads. FNV-1a + a
// murmur3-style finalizer: a plain "h*31+c" accumulator's lowest bit is just the parity of the
// slug's character codes (multiplying by an odd constant never changes a sum's lowest bit), which
// skews badly for similar slugs ("-silver" contributing the same parity to every one); the
// finalizer's shifts mix every bit together so %2 is actually close to a coin flip.
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

// A fixed salt, not a secret - just picked (and checked against the 9 silver slugs) so the parity
// split actually lands close to half instead of happening to skew for this small, similarly-named set.
const SILVER_SALT = "silver:0";

export function isJewelUrgencyEligible(product: { category: string; metal?: "gold" | "silver"; slug: string }): boolean {
  if (product.category !== "jewellery") return false;
  if (product.metal === "silver") return hashSlug(product.slug + SILVER_SALT) % 2 === 0;
  return true; // gold (or unset, which means gold on the classic line)
}

// Mostly 3-5 (owner, 21.11.2026: 7 read as "doesn't that defeat the point"); a 6 shows up now and
// then (15% of the time) so it's not a flat 3-piece ceiling every time, but never 2 or 7.
function randomStock(): number {
  if (Math.random() < 0.15) return 6;
  return 3 + Math.floor(Math.random() * 3); // 3..5
}

function randomPair(): JewelUrgency {
  return {
    stock: randomStock(),
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
