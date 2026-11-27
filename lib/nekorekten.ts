// SERVER ONLY (reads NEKOREKTEN_API_KEY): never import from a client component.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normPhone } from "./customer-risk-shared";

// Nekorekten.com API (official doc: https://nekorekten.com/bg/api/doc, read 27.11.2026). Only the two documented calls are used:
//   GET  https://api.nekorekten.com/api/v1/reports?phone=&email=&searchMode=one-of   -> { items: [...], count, ... }
//   POST https://api.nekorekten.com/api/v1/reports  { text (required), phone | email | siteUrl | facebookUrl (≥1), firstName, lastName }
// Auth: header "Api-Key: <key>". The key works ONLY from the IP addresses set on it at nekorekten.com (others get 403).
// Limits (free plan): 10 requests / minute, 100 searches / day -> we search once per NEW order and cache the answer 7 days.
// The key is server-only (NEKOREKTEN_API_KEY) and never leaves this file.

const BASE = "https://api.nekorekten.com";
const TIMEOUT_MS = 8_000;
export const CACHE_DAYS = 7;
const ERROR_BACKOFF_MS = 30 * 60_000;   // an automatic check does not retry a failed one for 30 min ("Провери отново" always does)
export const SOURCE = "nekorekten";

const apiKey = () => (process.env.NEKOREKTEN_API_KEY ?? "").trim();
export const nekorektenConfigured = (): boolean => apiKey().length > 0;

/** Their phone format: the country code + number as one string, e.g. 359888888888. */
const apiPhone = (norm: string) => norm.replace(/^\+/, "");

function errorText(status: number, body: unknown): string {
  const msg = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message ?? "") : "";
  const why: Record<number, string> = {
    400: "невалидна заявка", 401: "невалиден или неактивен API ключ", 403: "IP адресът на сървъра не е разрешен за ключа",
    405: "методът не се поддържа", 429: "достигнат лимит на заявките",
  };
  return [`HTTP ${status}`, why[status], msg].filter(Boolean).join(" · ").slice(0, 300);
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const key = apiKey();
  if (!key) return { ok: false, error: "NEKOREKTEN_API_KEY не е зададен" };
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: { "Api-Key": key, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: errorText(r.status, json) };
    if (!json || typeof json !== "object") return { ok: false, error: "празен отговор" };
    return { ok: true, json: json as Record<string, unknown> };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { ok: false, error: name === "TimeoutError" || name === "AbortError" ? `няма отговор за ${TIMEOUT_MS / 1000} s` : `мрежова грешка: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
  }
}

/** Search the reports about this phone (and e-mail, either one matching). */
export async function searchReports(phoneNorm: string, email?: string | null): Promise<{ ok: true; count: number; json: Record<string, unknown> } | { ok: false; error: string }> {
  const q = new URLSearchParams({ phone: apiPhone(phoneNorm), itemsPerPage: "20" });
  const mail = String(email ?? "").trim().toLowerCase();
  if (mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { q.set("email", mail); q.set("searchMode", "one-of"); }
  const r = await call("GET", `/api/v1/reports?${q}`);
  if (!r.ok) return r;
  const items = Array.isArray(r.json.items) ? r.json.items : [];
  const count = Number.isFinite(Number(r.json.count)) ? Number(r.json.count) : items.length;
  return { ok: true, count, json: r.json };
}

export type ReportPayload = { text: string; phone: string; firstName?: string; lastName?: string; email?: string };

/** Send ONE report. Only ever called from the panel after the owner confirmed the exact payload in the dialog. */
export async function createReport(p: ReportPayload): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  return call("POST", "/api/v1/reports", p);
}

/**
 * Check a customer and keep the answer in external_risk_checks. Without `force`, an answer younger than 7 days is reused
 * (no request), and a failure is not retried for 30 min. Never throws: a dead API only writes last_error.
 */
export async function checkCustomer(
  sb: SupabaseClient, phone: unknown, email?: string | null, opts: { force?: boolean } = {},
): Promise<{ status: "cached" | "checked" | "failed" | "skipped"; count?: number; error?: string }> {
  const norm = normPhone(phone);
  if (!norm) return { status: "skipped", error: "няма телефон" };
  if (!nekorektenConfigured()) return { status: "skipped", error: "NEKOREKTEN_API_KEY не е зададен" };
  try {
    const { data: prev } = await sb.from("external_risk_checks").select("reports_count, checked_at, last_error_at").eq("phone", norm).eq("source", SOURCE).maybeSingle();
    const p = prev as { reports_count: number | null; checked_at: string | null; last_error_at: string | null } | null;
    if (!opts.force && p) {
      if (p.checked_at && Date.now() - Date.parse(p.checked_at) < CACHE_DAYS * 86_400_000) return { status: "cached", count: p.reports_count ?? 0 };
      if (p.last_error_at && Date.now() - Date.parse(p.last_error_at) < ERROR_BACKOFF_MS) return { status: "skipped", error: "скорошна грешка" };
    }
    const r = await searchReports(norm, email);
    const now = new Date().toISOString();
    if (!r.ok) {
      console.error("[nekorekten] check failed:", r.error);
      const up = await sb.from("external_risk_checks").upsert({ phone: norm, source: SOURCE, last_error: r.error, last_error_at: now }, { onConflict: "phone,source" });
      if (up.error) console.error("[nekorekten] cache write failed:", up.error.message);
      return { status: "failed", error: r.error };
    }
    const up = await sb.from("external_risk_checks").upsert(
      { phone: norm, source: SOURCE, reports_count: r.count, raw_json: r.json, checked_at: now, last_error: null, last_error_at: null },
      { onConflict: "phone,source" },
    );
    if (up.error) console.error("[nekorekten] cache write failed:", up.error.message);
    return { status: "checked", count: r.count };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[nekorekten] check crashed:", error);
    return { status: "failed", error };
  }
}
