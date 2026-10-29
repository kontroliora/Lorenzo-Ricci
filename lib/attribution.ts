// Ad attribution on the order (29.10.2026): the middleware stores utm_source / utm_medium / utm_campaign / fbclid of the landing
// in a first-party cookie (last touch, 30 days); the order routes copy them onto the order (supabase: orders.utm_source,
// utm_medium, utm_campaign, fbclid - see the migration file); the admin order card shows them. Pure, edge-safe.
export const ATTR_COOKIE = "lr_attr";
export const ATTR_MAX_AGE = 30 * 24 * 60 * 60;
export const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "fbclid"] as const;
export type Attribution = Partial<Record<(typeof ATTR_KEYS)[number], string>>;

const clean = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim().slice(0, 200);
  return s && /^[\p{L}\p{N} ._\-|:+/()%#=&@!~,]+$/u.test(s) ? s : undefined;
};

/** The landing's attribution, or null when the URL carries none (then an earlier cookie is kept). */
export function attributionFromSearch(search: URLSearchParams): Attribution | null {
  const a: Attribution = {};
  for (const k of ATTR_KEYS) { const v = clean(search.get(k)); if (v) a[k] = v; }
  return Object.keys(a).length ? a : null;
}

export const encodeAttribution = (a: Attribution): string => encodeURIComponent(JSON.stringify(a));

/** Attribution from the cookie value (garbage-safe): only the four known keys, cleaned. */
export function attributionFromCookie(value: string | undefined): Attribution {
  if (!value) return {};
  try {
    const raw = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    const a: Attribution = {};
    for (const k of ATTR_KEYS) { const v = clean(raw?.[k]); if (v) a[k] = v; }
    return a;
  } catch { return {}; }
}
