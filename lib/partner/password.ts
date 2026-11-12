import bcrypt from "bcryptjs";
import { kv } from "@vercel/kv";
import { supabaseAdmin } from "../supabase-admin";
import { sendTelegram } from "../telegram";
import { normEmail, type Partner } from "./access";

// Password sign-in for the partner (owner, 09.11.2026), next to the magic link. The password lives ONLY as a bcrypt hash in
// partners.password_hash (supabase/partner_password.sql); it is never stored, logged or sent anywhere in plain text.
// Brute force: at most 5 wrong attempts per 15 minutes per e-mail and per IP; the 5th locks that e-mail / IP for 15 minutes
// (even the right password is refused meanwhile) and alerts the owner on Telegram once. The session afterwards is the same
// 30-day signed cookie as the magic link, so the owner's on/off toggle (enabled + revoked_before) ends it the same way.

const MAX_FAILS = 5;
const WINDOW_S = 15 * 60;
// A real bcrypt hash of a random string: compared when there is no account / no password, so the answer takes as long.
const DUMMY_HASH = "$2b$12$N/qWYSabvgtdOUlCJSuRN.NvTjaX42Da1LJGuAWoZqtaVBtP9RhNm";

const failKey = (kind: "email" | "ip", v: string) => `partner-pw-fail:${kind}:${v}`;
const lockKey = (kind: "email" | "ip", v: string) => `partner-pw-lock:${kind}:${v}`;

export type PasswordResult = { ok: true; partner: Partner } | { ok: false; locked: boolean; retryAfter?: number };

/** Seconds left on the e-mail / IP lock (the longer one), 0 when not locked. */
export async function lockSecondsLeft(email: string, ip: string): Promise<number> {
  const [a, b] = await Promise.all([kv.ttl(lockKey("email", email)), ip ? kv.ttl(lockKey("ip", ip)) : -2]);
  return Math.max(0, a, b);
}

async function fail(email: string, ip: string): Promise<boolean> {
  const targets: ["email" | "ip", string][] = [["email", email], ...(ip ? [["ip", ip] as ["ip", string]] : [])];
  let locked = false;
  for (const [kind, v] of targets) {
    const n = await kv.incr(failKey(kind, v));
    if (n === 1) await kv.expire(failKey(kind, v), WINDOW_S);
    if (n >= MAX_FAILS) {
      locked = true;
      const fresh = await kv.set(lockKey(kind, v), 1, { ex: WINDOW_S, nx: true });
      await kv.del(failKey(kind, v));
      if (fresh) {
        const who = kind === "email" ? `имейл ${v}` : `IP ${v}`;
        const t = await sendTelegram(`🔒 <b>Партньорски панел</b>: ${MAX_FAILS} грешни пароли за 15 мин (${who.replace(/[<>&]/g, "")}). Входът с парола е заключен за 15 минути.`);
        if (!t.ok) console.error("[partner] lockout alert failed:", t.error);
      }
    }
  }
  return locked;
}

/** Checks e-mail + password. Never throws on a wrong / unknown login; the reason is not revealed (only "locked"). */
export async function passwordLogin(emailRaw: unknown, passwordRaw: unknown, ip: string): Promise<PasswordResult> {
  const email = normEmail(emailRaw);
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  const left = await lockSecondsLeft(email, ip);
  if (left > 0) return { ok: false, locked: true, retryAfter: left };

  type Row = Partner & { password_hash?: string | null };
  let row = null as Row | null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200) {
    const { data, error } = await supabaseAdmin().from("partners")
      .select("email, name, enabled, notify, revoked_before, password_hash").eq("email", email).maybeSingle();
    if (error) console.error("[partner] password lookup failed:", error.message);   // e.g. the column is not there yet
    row = (data as Row | null) ?? null;
  }
  const hash = row?.password_hash && row.enabled ? row.password_hash : DUMMY_HASH;
  const match = password.length > 0 && password.length <= 200 && (await bcrypt.compare(password, hash));
  if (!match || hash === DUMMY_HASH || !row) {
    const locked = await fail(email, ip);
    return { ok: false, locked, ...(locked ? { retryAfter: await lockSecondsLeft(email, ip) } : {}) };
  }

  await kv.del(failKey("email", email));
  const { password_hash: _drop, ...partner } = row;
  void _drop;
  return { ok: true, partner };
}

