// Romanian mobile number -> 10 national digits (07xxxxxxxx), or null. ONE rule for the checkout form and /api/order-ro, so the
// browser and the server can never disagree (29.10.2026: the form accepted "+40 0712 345 678" and the server refused it).
// Accepts 07.., +407.., +40 07.., 00407.., 0040 07.., 407.. (11 digits), with spaces / dots / dashes / brackets.
export function normalizeRoPhone(raw: string): string | null {
  let s = String(raw ?? "").trim().replace(/[\s().\-–]/g, "");
  let national: string;
  if (s.startsWith("+")) {
    s = s.slice(1);
    if (!/^\d+$/.test(s) || !s.startsWith("40")) return null;
    national = s.slice(2);
  } else {
    if (!/^\d+$/.test(s)) return null;
    if (s.startsWith("0040")) national = s.slice(4);
    else if (s.startsWith("40") && s.length === 11) national = s.slice(2);
    else national = s;
  }
  national = national.replace(/^0/, "");   // "+40 0712…" / "0040 0712…": the trunk 0 after the country code
  return /^7\d{8}$/.test(national) ? `0${national}` : null;
}
