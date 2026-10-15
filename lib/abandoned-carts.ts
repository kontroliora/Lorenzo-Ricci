// Panel "Изоставени колички" (Bulgaria only): saved carts of customers who typed their phone in the checkout and never ordered, for the
// staff to phone. Pure logic (no server imports), so the client list and the tests use the very same rules; the database read is in
// lib/abandoned-carts-server.ts.
//
// A cart is listed when ALL of this holds:
//   - it is Bulgarian (not lang 'ro'), still open (status pending / emailed), and the customer typed a phone number;
//   - its value is ABOVE EUR 80;
//   - it was abandoned (last activity) 1 to 24 hours ago -> section "recent"; older (up to 14 days) -> section "missed";
//   - nobody has already called it off: not "не иска", not "не вдига" twice;
//   - the same customer (phone OR e-mail) has not placed an order since the cart was started (then it disappears by itself).

export const CART_MIN_EUR = 80;          // strictly above
export const CART_RECENT_FROM_H = 1;
export const CART_RECENT_TO_H = 24;
export const CART_KEEP_DAYS = 14;        // older carts are dropped from the panel altogether
export const CART_MAX_NO_ANSWER = 2;     // after this many "не вдига" the cart is hidden

export type CartCallState = "will_order" | "declined" | "no_answer";

/** A cart_sessions row as read from the database (columns the call buttons add may be missing until the SQL has run). */
export type CartRow = {
  id: string;
  session_id?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  items?: unknown;
  subtotal?: number | string | null;
  status?: string | null;
  lang?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  recovery_sent_at?: string | null;
  call_state?: string | null;
  call_attempts?: number | null;
  last_call_at?: string | null;
};

export type OrderRef = { phone?: string | null; email?: string | null; created_at: string };

export type CartItemView = { name: string; slug: string; image: string | null; quantity: number; price: number };

export type AbandonedCart = {
  id: string;
  name: string;
  phone: string;
  email: string;
  items: CartItemView[];
  subtotal: number;
  updatedAt: string;           // last activity = when the customer left
  createdAt: string;
  emailedAt: string | null;    // the reminder e-mail went out at this time
  callState: CartCallState | null;
  callAttempts: number;
  lastCallAt: string | null;
};

/** Phone as comparable digits: no spaces/+/dashes, no country code (359 / 40), no leading zero. "0888 123 456" = "+359888123456". */
export function phoneCore(p: string | null | undefined): string {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("359")) d = d.slice(3);
  else if (d.startsWith("40") && d.length >= 11) d = d.slice(2);
  return d.replace(/^0+/, "");
}

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);

export function cartItems(raw: unknown): CartItemView[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const it = (x ?? {}) as Record<string, unknown>;
    const cover = (it.coverImage ?? null) as { src?: unknown } | null;
    const image = typeof cover?.src === "string" ? cover.src : typeof it.image === "string" ? it.image : null;
    return {
      name: String(it.name ?? it.slug ?? "Продукт"),
      slug: String(it.slug ?? ""),
      image,
      quantity: Math.max(1, Number(it.quantity ?? it.qty ?? 1) || 1),
      price: Number(it.price ?? 0) || 0,
    };
  });
}

/** Which list a cart belongs to at `nowMs`: "wait" (left less than an hour ago, not yet), "recent" (1-24 h), "missed" (older). */
export function cartSection(updatedAt: string, nowMs: number): "wait" | "recent" | "missed" {
  const ageH = (nowMs - Date.parse(updatedAt)) / 3_600_000;
  if (!(ageH >= CART_RECENT_FROM_H)) return "wait";
  return ageH <= CART_RECENT_TO_H ? "recent" : "missed";
}

/** The carts to show (newest first). The 1 h / 24 h split is applied by the caller with cartSection (the screen's clock keeps ticking). */
export function selectAbandoned(rows: CartRow[], orders: OrderRef[], nowMs: number): AbandonedCart[] {
  // Later orders by phone / e-mail, newest-agnostic: a cart is covered when one of them was placed at or after the cart's start.
  const byPhone = new Map<string, number[]>();
  const byEmail = new Map<string, number[]>();
  for (const o of orders) {
    const t = ms(o.created_at);
    if (!Number.isFinite(t)) continue;
    const pc = phoneCore(o.phone);
    if (pc.length >= 8) byPhone.set(pc, [...(byPhone.get(pc) ?? []), t]);
    const em = String(o.email ?? "").trim().toLowerCase();
    if (em) byEmail.set(em, [...(byEmail.get(em) ?? []), t]);
  }

  const out: AbandonedCart[] = [];
  for (const r of rows) {
    if (r.lang === "ro") continue;                                              // Romanian carts are not called from here
    if (r.status !== "pending" && r.status !== "emailed") continue;             // converted / opted out
    const pc = phoneCore(r.phone);
    if (pc.length < 8) continue;                                                // no phone, nothing to call
    const subtotal = Number(r.subtotal ?? 0);
    if (!(subtotal > CART_MIN_EUR)) continue;
    const state = (r.call_state ?? null) as CartCallState | null;
    const attempts = Number(r.call_attempts ?? 0) || 0;
    if (state === "declined") continue;
    if (state === "no_answer" && attempts >= CART_MAX_NO_ANSWER) continue;
    const updated = r.updated_at ?? r.created_at ?? "";
    const created = r.created_at ?? r.updated_at ?? "";
    if (!Number.isFinite(ms(updated))) continue;
    if ((nowMs - ms(updated)) / 86_400_000 > CART_KEEP_DAYS) continue;
    const startedAt = ms(created);
    const em = String(r.email ?? "").trim().toLowerCase();
    const ordered = [...(byPhone.get(pc) ?? []), ...(em ? byEmail.get(em) ?? [] : [])].some((t) => !Number.isFinite(startedAt) || t >= startedAt);
    if (ordered) continue;                                                      // the customer ordered after all

    out.push({
      id: r.id,
      name: (r.name ?? "").trim(),
      phone: String(r.phone ?? "").trim(),
      email: em,
      items: cartItems(r.items),
      subtotal,
      updatedAt: updated,
      createdAt: created,
      emailedAt: r.recovery_sent_at ?? (r.status === "emailed" ? r.updated_at ?? null : null),
      callState: state,
      callAttempts: attempts,
      lastCallAt: r.last_call_at ?? null,
    });
  }
  return out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** "преди 3 ч 20 мин" */
export function fmtAgo(nowMs: number, iso: string): string {
  const min = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (min < 60) return `преди ${min} мин`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 48) return `преди ${h} ч${m ? ` ${m} мин` : ""}`;
  return `преди ${Math.floor(h / 24)} дни`;
}
