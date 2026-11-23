// Phone check of the Bulgarian checkout - ONE rule for the browser and /api/order (owner, 23.11.2026).
//   - a Bulgarian number: 0XXXXXXXXX (10 digits), or the same with +359 / 00359 / 359 instead of the 0;
//   - any other number written internationally: 10-15 digits (E.164), as the form always accepted.
// Spaces, dashes, dots and brackets are ignored.
export const PHONE_ERROR_BG = "Моля, въведете валиден телефонен номер.";

export function isValidPhoneBg(raw: unknown): boolean {
  const s = String(raw ?? "").trim();
  if (!s || /[^\d\s+()./-]/.test(s)) return false;
  let d = s.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("359")) return /^0[2-9]\d{8}$/.test("0" + d.slice(3));
  if (d.startsWith("0")) return /^0[2-9]\d{8}$/.test(d);
  return d.length >= 10 && d.length <= 15;
}
