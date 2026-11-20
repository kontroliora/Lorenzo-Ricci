// Fake "running low" urgency line for women's jewellery product pages only (owner, 21.11.2026): a
// made-up remaining-count (2-6) and viewer-count (4-15) with no link to the real inventory - that
// still comes from lib/live-stock.ts / /api/stock and decides the real sold-out state. This is
// cosmetic only, shown instead of the real low-stock line while the piece is genuinely in stock.
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

function randomPair(): JewelUrgency {
  return {
    stock: 2 + Math.floor(Math.random() * 5), // 2..6
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
