import { createHmac, timingSafeEqual } from "node:crypto";

// Signed link of the "Потвърдете поръчката си" e-mail (lib/confirm-request.ts):
//   /potvardi/<base64url(JSON {o: orderId, e: expiryMs, t?: 1})>.<base64url(HMAC-SHA256("confirm:" + payload))>
// Valid 7 days from sending. t=1 marks the owner's TEST e-mail: its link shows the thank-you page and changes nothing.
// Secret: ORDER_CONFIRM_SECRET, else CRON_SECRET (already set in production). No secret -> no links (fails closed).
// "One-time" is enforced by the database, not by the token: the first click confirms; later clicks only show "already confirmed".

const secret = () => (process.env.ORDER_CONFIRM_SECRET || process.env.CRON_SECRET || "").trim();
export const CONFIRM_LINK_DAYS = 7;

export type ConfirmClaim = { orderId: number; expiresAt: number; test: boolean };

const sign = (payload: string, s: string) => createHmac("sha256", s).update("confirm:" + payload).digest("base64url");

export function confirmToken(orderId: number, opts: { test?: boolean; now?: number } = {}): string | null {
  const s = secret();
  if (!s || !Number.isInteger(orderId) || orderId <= 0) return null;
  const body: Record<string, number> = { o: orderId, e: (opts.now ?? Date.now()) + CONFIRM_LINK_DAYS * 86_400_000 };
  if (opts.test) body.t = 1;
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload, s)}`;
}

export type VerifyResult = { ok: true; claim: ConfirmClaim } | { ok: false; reason: "invalid" | "expired"; orderId?: number };

export function verifyConfirmToken(token: string | null | undefined, now = Date.now()): VerifyResult {
  const s = secret();
  const raw = decodeURIComponent(String(token ?? ""));
  const dot = raw.indexOf(".");
  if (!s || dot < 1) return { ok: false, reason: "invalid" };
  const payload = raw.slice(0, dot);
  const a = Buffer.from(sign(payload, s));
  const b = Buffer.from(raw.slice(dot + 1));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  let body: { o?: unknown; e?: unknown; t?: unknown };
  try { body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return { ok: false, reason: "invalid" }; }
  const orderId = Number(body.o);
  const expiresAt = Number(body.e);
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isFinite(expiresAt)) return { ok: false, reason: "invalid" };
  if (now > expiresAt) return { ok: false, reason: "expired", orderId };
  return { ok: true, claim: { orderId, expiresAt, test: body.t === 1 } };
}
