import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { kv } from "@vercel/kv";
import { supabaseAdmin } from "../supabase-admin";

// The partner's sign-in (owner, 09.11.2026). He has NO Supabase Auth account on purpose: every table open to "authenticated"
// (the panel's orders, stock, traffic ...) stays closed to him, and /lr-panel-v8m3q + /api/admin keep refusing him (no Supabase
// session). Instead: a magic link the site e-mails (single use, 15 min, stored hashed in KV) -> a signed cookie valid 30 days.
// Every request re-reads his `partners` row, so the owner's toggle (enabled = false) shuts him out at once, old cookies included
// (revoked_before).

export const PARTNER_COOKIE = "lr_partner";
export const SESSION_DAYS = 30;
const LINK_TTL_S = 15 * 60;            // a link he asked for
const INVITE_TTL_S = 7 * 86_400;       // the invitation: 7 days (single use all the same)

export type Partner = { email: string; name: string | null; enabled: boolean; notify: boolean; revoked_before: string | null };

export const normEmail = (s: unknown): string => String(s ?? "").trim().toLowerCase();

function secret(): Buffer {
  const base = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/\s/g, "");
  if (!base) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createHmac("sha256", base).update("lr-partner-session-v1").digest();
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signSession(email: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ e: normEmail(email), iat: now, exp: now + SESSION_DAYS * 86_400_000 }));
  return `${payload}.${sign(payload)}`;
}

/** The cookie's content if its signature is right and it has not expired; null otherwise. */
export function readSession(value: string | undefined | null): { email: string; iat: number } | null {
  const [payload, sig] = String(value ?? "").split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e?: string; iat?: number; exp?: number };
    if (!p.e || typeof p.iat !== "number" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { email: p.e, iat: p.iat };
  } catch { return null; }
}

export async function getPartnerRow(email: string): Promise<Partner | null> {
  const { data, error } = await supabaseAdmin().from("partners")
    .select("email, name, enabled, notify, revoked_before").eq("email", normEmail(email)).maybeSingle();
  if (error) { console.error("[partner] partners read failed:", error.message); return null; }
  return (data as Partner | null) ?? null;
}

/** The signed-in, ENABLED partner of this cookie, or null (no cookie, bad signature, expired, disabled, revoked). */
export async function partnerFromCookie(value: string | undefined | null): Promise<Partner | null> {
  const s = readSession(value);
  if (!s) return null;
  const p = await getPartnerRow(s.email);
  if (!p || !p.enabled) return null;
  if (p.revoked_before && s.iat < new Date(p.revoked_before).getTime()) return null;
  return p;
}

export const cookieOptions = {
  httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86_400,
};

// ── magic link ──────────────────────────────────────────────────────────────
const linkKey = (token: string) => `partner-login:${createHash("sha256").update(token).digest("hex")}`;

export async function issueLoginToken(email: string, kind: "login" | "invite" = "login"): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await kv.set(linkKey(token), normEmail(email), { ex: kind === "invite" ? INVITE_TTL_S : LINK_TTL_S });
  return token;
}

/** Single use: the token is deleted when read. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const email = await kv.getdel<string>(linkKey(token));
  return email ? normEmail(email) : null;
}

/** At most 5 link e-mails per address per 15 minutes. */
export async function loginRateOk(email: string): Promise<boolean> {
  const k = `partner-login-rate:${normEmail(email)}`;
  const n = await kv.incr(k);
  if (n === 1) await kv.expire(k, LINK_TTL_S);
  return n <= 5;
}
