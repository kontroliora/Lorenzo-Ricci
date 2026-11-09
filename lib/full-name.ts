// First AND last name in the single checkout name field (BG + RO, owner 09.11.2026).
// Valid = at least 2 words separated by spaces, each word only letters (Latin incl. diacritics, or Cyrillic) with optional
// hyphens between letter groups ("Иванова-Петрова"), and at least 2 letters per word. Shared by the checkout forms and
// /api/order + /api/order-ro, so the browser and the server apply the same rule.
// Explicit ranges instead of \p{Script=...}: the tsconfig target is ES2017.
const L = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF\\u0400-\\u04FF";
const WORD_RE = new RegExp(`^[${L}]+(?:-[${L}]+)*$`);

export const FULL_NAME_ERROR_BG = "Моля, въведете име и фамилия";
export const FULL_NAME_ERROR_RO = "Vă rugăm să introduceți numele și prenumele";

export function isValidFullName(raw: unknown): boolean {
  const words = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every((w) => WORD_RE.test(w) && w.replace(/-/g, "").length >= 2);
}
