// Customer-matching keys for Meta (Pixel + Conversions API). Pure functions that run in the browser and on the server:
// normalise first, hash second (SHA-256, lower-case hex), as Meta's customer-information-parameters spec asks.
export type Market = "bg" | "ro";

/** Country calling codes (digits only, no "+") of the two markets. */
export const CALLING_CODE: Record<Market, string> = { bg: "359", ro: "40" };

export const isSha256Hex = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);

/** Lower-cased, trimmed e-mail, or undefined when it does not look like one. */
export function normalizeEmail(raw: unknown): string | undefined {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}

/**
 * Digits only, WITH the country code and no leading zeros or "+": 0888 123 456 -> 359888123456 (BG), 0712 345 678 -> 40712345678 (RO).
 * "+359 (0)888..." and "00359888..." are handled; a number that is clearly from another country is kept as typed (digits only).
 * Returns undefined when nothing usable is left.
 */
export function normalizePhone(raw: unknown, market: Market): string | undefined {
  const cc = CALLING_CODE[market];
  const typed = String(raw ?? "").trim();
  let d = typed.replace(/\D/g, "");
  if (!d) return undefined;
  const intl = typed.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(cc)) {
    const rest = d.slice(cc.length).replace(/^0+/, ""); // "+359 (0)888 ..." carries a stray 0 after the code
    if (rest.length >= 8 && rest.length <= 10) return cc + rest;
  }
  if (!intl) {
    const rest = d.replace(/^0+/, "");
    if (rest.length >= 8 && rest.length <= 10) return cc + rest; // national number: 0888..., 888...
  }
  return d.length >= 8 ? d : undefined; // other country, already international
}

/** SHA-256 as lower-case hex (WebCrypto: works in browsers and in Node 18+). */
export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
