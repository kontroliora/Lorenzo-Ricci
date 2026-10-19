// One place for the server side of Meta's Conversions API: the Graph version, the user_data builder, the event_source_url rule
// and the POST itself. Events are deduplicated with the browser pixel through event_id (callers set it; this file never touches it).
//
// Test mode: when META_CAPI_TEST_EVENT_CODE is set every event carries that test_event_code, so it shows up ONLY in Events Manager ->
// Test events and never reaches the live data. Used to verify payloads without touching the ad account's numbers.
import { createHash } from "node:crypto";
import { isSha256Hex, normalizeEmail, normalizePhone, type Market } from "@/lib/match-keys";

export const META_PIXEL_ID = "661480326560209";
/** Newest Graph API version (v27 does not exist yet: it answers "Unknown path components"). */
export const GRAPH_VERSION = "v26.0";
export const SITE_ORIGIN = "https://www.lorenzo-ricci.com";

const SITE_HOSTS = new Set(["www.lorenzo-ricci.com", "lorenzo-ricci.com"]);

export const sha256 = (value: string): string => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

export const testEventCode = (): string | undefined => process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined;

/**
 * The page the event happened on. Only our own https pages are accepted (the value comes from a browser); the apex host is
 * rewritten to www, the fragment is dropped. Anything else falls back to `fallbackPath` on the www site.
 */
export function eventSourceUrl(candidate: unknown, fallbackPath = "/"): string {
  try {
    if (typeof candidate === "string" && candidate) {
      const u = new URL(candidate);
      if (u.protocol === "https:" && SITE_HOSTS.has(u.hostname)) {
        u.hostname = "www.lorenzo-ricci.com";
        u.hash = "";
        return u.toString().slice(0, 1000);
      }
    }
  } catch { /* fall through */ }
  return SITE_ORIGIN + fallbackPath;
}

/** What the server knows about the visitor's request (cookies, headers). All optional. */
export type CapiContext = {
  ip?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  /** Value of the first-party lr_xid cookie (random id of this browser): sent hashed as external_id. */
  externalId?: string;
  /** Page URL of the event (Referer of the order request); validated by eventSourceUrl(). */
  sourceUrl?: string;
};

/** Customer details; plain values are normalised and hashed here, ready-made hashes (from the browser) are passed through. */
export type CapiCustomer = {
  email?: string;
  phone?: string;
  emHash?: string;
  phHash?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  zip?: string;
};

export function buildUserData(market: Market, ctx: CapiContext = {}, who: CapiCustomer = {}): Record<string, unknown> {
  const u: Record<string, unknown> = { country: [sha256(market)] };
  const email = normalizeEmail(who.email);
  const phone = normalizePhone(who.phone, market);
  if (email) u.em = [sha256(email)];
  else if (isSha256Hex(who.emHash)) u.em = [who.emHash];
  if (phone) u.ph = [sha256(phone)];
  else if (isSha256Hex(who.phHash)) u.ph = [who.phHash];
  const first = who.firstName?.trim().toLowerCase();
  const last = who.lastName?.trim().toLowerCase();
  if (first) u.fn = [sha256(first)];
  if (last) u.ln = [sha256(last)];
  const city = who.city?.trim().toLowerCase().replace(/\s+/g, "");
  const zip = who.zip?.trim().toLowerCase().replace(/\s+/g, "");
  if (city) u.ct = [sha256(city)];
  if (zip) u.zp = [sha256(zip)];
  if (ctx.externalId && ctx.externalId.length <= 100) u.external_id = [sha256(ctx.externalId)];
  if (ctx.ip) u.client_ip_address = ctx.ip;
  if (ctx.userAgent) u.client_user_agent = ctx.userAgent;
  if (ctx.fbc) u.fbc = ctx.fbc;
  if (ctx.fbp) u.fbp = ctx.fbp;
  return u;
}

export type CapiSendResult = { ok: boolean; status: number; body: unknown; payload: Record<string, unknown> };

/** POST events to the pixel. The access token is added here and is never part of the returned payload. */
export async function sendCapiEvents(events: Record<string, unknown>[], timeoutMs = 5000): Promise<CapiSendResult> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const payload: Record<string, unknown> = { data: events };
  const test = testEventCode();
  if (test) payload.test_event_code = test;
  if (!token) return { ok: false, status: 0, body: { error: "META_CAPI_ACCESS_TOKEN not set" }, payload };
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, access_token: token }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, body, payload };
}

/** Purchases go out from production deployments only; with a test code any environment may send (test events never count). */
export const mayPostPurchase = (): boolean => process.env.VERCEL_ENV === "production" || Boolean(testEventCode());
