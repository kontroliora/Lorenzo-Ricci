// Repeat orders from one customer ("Повторна поръчка"). Pure functions, no imports with side effects: they run in the admin board (browser),
// in the server notification and in the checkout guard, and can be tested with plain node.
//
// Two orders are RELATED when at least one of these matches AND they are at most 72 hours apart:
//   a) e-mail (lower-case, trimmed)
//   b) phone (digits only, the last 9 compared - so 0888 123 456, +359 888 123 456 and 00359888123456 are one number)
//   c) name + address (lower-case, letters and digits only)
// A cancelled order, an order the owner marked "не е дубликат", a fake/test order and an unpaid card attempt do not count at all.
// A group is a chain of related orders (A~B, B~C puts all three together), so "N" is the number of orders in the group.
//
// Nothing is stored for the grouping itself: it is computed from the orders when they are read (the board loads up to 1000 and the
// computation is O(n log n)). The only stored fact is the owner's "не е дубликат" (orders.duplicate_dismissed_at).

export const DUP_WINDOW_HOURS = 72;
export const DUP_WINDOW_MS = DUP_WINDOW_HOURS * 3_600_000;

export type DupLine = { slug?: unknown; sku?: unknown; name?: unknown; quantity?: unknown; qty?: unknown; gift?: unknown };
export type DupOrder = {
  id: number;
  order_ref: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  created_at: string;
  items?: DupLine[] | null;
  total?: number | null;
  excluded_from_stock?: boolean | null;
  duplicate_dismissed_at?: string | null;   // undefined until supabase/orders_duplicates.sql has run
  payment_method?: string | null;
  payment_status?: string | null;
  is_international?: boolean | null;
  ship_country?: string | null;
};

export type DupGroup = {
  id: number;               // the smallest order id in the group (stable while the group keeps its first order)
  orders: DupOrder[];       // oldest first
  sameProducts: boolean;    // every order has exactly the same (paid) products and quantities
};

export const normEmail = (raw: unknown): string => String(raw ?? "").trim().toLowerCase();

/** Digits only; the last 9 when there are at least 9, else all of them when there are at least 7, else "" (not a usable phone). */
export function normPhone(raw: unknown): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length >= 9) return d.slice(-9);
  return d.length >= 7 ? d : "";
}

const lettersDigits = (s: unknown): string => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Name + address as one key, or "" when either is empty (a name alone proves nothing). */
export function normNameAddress(name: unknown, address: unknown): string {
  const n = lettersDigits(name);
  const a = lettersDigits(address);
  return n && a ? `${n}|${a}` : "";
}

/** Does this order take part in duplicate detection at all? `extra` lets the caller add its own exclusion (e.g. unpaid card attempts). */
export function countsForDuplicates(o: DupOrder): boolean {
  if (o.status === "cancelled") return false;
  if (o.duplicate_dismissed_at) return false;
  if (o.excluded_from_stock) return false;
  if (o.status === "pending_payment") return false;   // an open card payment is not an order yet
  return true;
}

const t = (o: DupOrder): number => new Date(o.created_at).getTime();

const qtyOf = (l: DupLine): number => Math.max(1, Number(l.quantity ?? l.qty ?? 1));

/** "slug×qty" of the paid lines, sorted: two orders with the same signature contain exactly the same products. */
export function productSignature(items: DupLine[] | null | undefined): string {
  const map = new Map<string, number>();
  for (const l of items ?? []) {
    if (l.gift) continue;
    const key = String(l.slug ?? l.sku ?? l.name ?? "").trim().toLowerCase();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + qtyOf(l));
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, q]) => `${k}×${q}`).join(",");
}

/** The paid products' slugs (gifts excluded). */
export const paidSlugs = (items: DupLine[] | null | undefined): string[] =>
  [...new Set((items ?? []).filter((l) => !l.gift).map((l) => String(l.slug ?? l.sku ?? "").trim().toLowerCase()).filter(Boolean))];

/** Are these two orders related (match on e-mail, phone or name+address, within the window)? */
export function areRelated(a: DupOrder, b: DupOrder, windowMs = DUP_WINDOW_MS): boolean {
  if (Math.abs(t(a) - t(b)) > windowMs) return false;
  const ea = normEmail(a.email), eb = normEmail(b.email);
  if (ea && ea === eb) return true;
  const pa = normPhone(a.phone), pb = normPhone(b.phone);
  if (pa && pa === pb) return true;
  const na = normNameAddress(a.name, a.address), nb = normNameAddress(b.name, b.address);
  return !!na && na === nb;
}

/**
 * Groups of 2+ related orders. `byId` maps every grouped order's id to its group; an order with no relative is not in it.
 * `eligible` replaces the default eligibility (countsForDuplicates) when the caller needs a stricter one.
 */
export function buildDuplicateGroups(
  orders: DupOrder[],
  opts: { windowMs?: number; eligible?: (o: DupOrder) => boolean } = {},
): { groups: DupGroup[]; byId: Map<number, DupGroup> } {
  const windowMs = opts.windowMs ?? DUP_WINDOW_MS;
  const eligible = opts.eligible ?? countsForDuplicates;
  const list = orders.filter(eligible).sort((a, b) => t(a) - t(b) || a.id - b.id);

  // union-find over order ids
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; }
    return r;
  };
  for (const o of list) parent.set(o.id, o.id);
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); };

  // One bucket per key (e-mail / phone / name+address). Inside a bucket (sorted by time) neighbours closer than the window are related;
  // that is enough: if A and C are within the window, so is every order between them.
  const buckets = new Map<string, DupOrder[]>();
  const put = (key: string, o: DupOrder) => { if (key) (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(o); };
  for (const o of list) {
    const e = normEmail(o.email); put(e && `e:${e}`, o);
    const p = normPhone(o.phone); put(p && `p:${p}`, o);
    const na = normNameAddress(o.name, o.address); put(na && `n:${na}`, o);
  }
  for (const arr of buckets.values()) {
    for (let i = 1; i < arr.length; i++) if (t(arr[i]) - t(arr[i - 1]) <= windowMs) union(arr[i].id, arr[i - 1].id);
  }

  const members = new Map<number, DupOrder[]>();
  for (const o of list) (members.get(find(o.id)) ?? members.set(find(o.id), []).get(find(o.id))!).push(o);

  const groups: DupGroup[] = [];
  const byId = new Map<number, DupGroup>();
  for (const [root, arr] of members) {
    if (arr.length < 2) continue;
    const sigs = new Set(arr.map((o) => productSignature(o.items)));
    const g: DupGroup = { id: root, orders: arr, sameProducts: sigs.size === 1 && !sigs.has("") };
    groups.push(g);
    for (const o of arr) byId.set(o.id, g);
  }
  groups.sort((a, b) => t(b.orders[b.orders.length - 1]) - t(a.orders[a.orders.length - 1]));
  return { groups, byId };
}

/**
 * Checkout guard: an order of the same e-mail or phone, not cancelled, placed in the last `hours` that contains one of `slugs`.
 * Returns the newest such order, or null.
 */
export function findRecentSameProduct(
  recent: DupOrder[],
  who: { email?: unknown; phone?: unknown },
  slugs: string[],
  nowMs = Date.now(),
  hours = 24,
): DupOrder | null {
  const email = normEmail(who.email), phone = normPhone(who.phone);
  if (!email && !phone) return null;
  const want = new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (!want.size) return null;
  const hit = recent
    .filter((o) => o.status !== "cancelled" && !o.excluded_from_stock && nowMs - t(o) <= hours * 3_600_000)
    .filter((o) => (email && normEmail(o.email) === email) || (phone && normPhone(o.phone) === phone))
    .filter((o) => paidSlugs(o.items).some((s) => want.has(s)))
    .sort((a, b) => t(b) - t(a));
  return hit[0] ?? null;
}
