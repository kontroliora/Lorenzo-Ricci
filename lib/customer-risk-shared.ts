// Некоректни клиенти (27.11.2026) - the client-safe half: types, the phone rule, and the words the panel shows.
// The numbers come from the database (supabase/customer_risk.sql -> customer_risk_many), see lib/customer-risk.ts.

/**
 * The SAME rule as the SQL function lr_norm_phone() - one format, +359XXXXXXXXX: "0888 123 456", "359888123456", "00359…",
 * "+359 (888) 12-34-56" and "888123456" are the same number. A foreign number stays E.164 (+40…). Empty/garbage -> null.
 * Keep the two in step (both were checked against the same list of formats on 27.11.2026).
 */
export function normPhone(p: unknown): string | null {
  let d = String(p ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("359") && d.length >= 11) {
    d = d.slice(3);
    if (d.startsWith("0")) d = d.slice(1);
    return "+359" + d;
  }
  if (d.startsWith("0") && d.length === 10) return "+359" + d.slice(1);
  if (d.length === 9 && (d[0] === "8" || d[0] === "9")) return "+359" + d;
  return "+" + d;
}

export type RiskIncident = { id: number; ref: string | null; kind: "uncollected" | "refused" | string; at: string; site: string | null };

export type CustomerRisk = {
  phone: string;               // normalized
  uncollected: number;         // непотърсени
  refused: number;             // отказани (at the office)
  returnedOther: number;       // returned, Econt has not said which (still an incident)
  completed: number;           // успешни (delivered)
  lastIncidentAt: string | null;
  incidents: RiskIncident[];   // newest first
  manual: { flagged: boolean; note: string | null; by: string | null; at: string | null } | null;
  external: { reports: number | null; checkedAt: string | null; error: string | null; errorAt: string | null } | null;
};

export type RiskLevel = "bad" | "warn" | null;

export const incidentCount = (r: CustomerRisk): number => r.uncollected + r.refused + r.returnedOther;

/** НЕКОРЕКТЕН = ≥1 непотърсена / отказана / върната пратка, or marked by hand. ВНИМАНИЕ = none of ours, but external reports. */
export function riskLevel(r: CustomerRisk | null | undefined): RiskLevel {
  if (!r) return null;
  if (incidentCount(r) > 0 || r.manual?.flagged) return "bad";
  if ((r.external?.reports ?? 0) > 0) return "warn";
  return null;
}

/** "12.11.2026" in Sofia time. */
export function bgDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric" }).format(d).replace(/\s?г\.?$/, "");
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Our incidents in one line: "2× непотърсена, 1× отказана (последно 12.11.2026)". Empty when there are none. */
export function internalReason(r: CustomerRisk): string {
  const parts: string[] = [];
  if (r.uncollected) parts.push(`${r.uncollected}× непотърсена`);
  if (r.refused) parts.push(`${r.refused}× отказана`);
  if (r.returnedOther) parts.push(`${r.returnedOther}× върната`);
  if (!parts.length) return "";
  const last = bgDate(r.lastIncidentAt);
  return parts.join(", ") + (last ? ` (последно ${last})` : "");
}

/** "Nekorekten.com: 3 доклада" - only when there is at least one report. */
export function externalReason(r: CustomerRisk): string {
  const n = r.external?.reports ?? 0;
  return n > 0 ? `Nekorekten.com: ${n} ${plural(n, "доклад", "доклада")}` : "";
}

/** Everything under the badge, e.g. "2× непотърсена (последно 12.11.2026) · Nekorekten.com: 3 доклада · ръчно маркиран". */
export function riskReason(r: CustomerRisk): string {
  return [internalReason(r), externalReason(r), r.manual?.flagged ? "ръчно маркиран" : ""].filter(Boolean).join(" · ");
}

/** Why the last external check failed, from the stored error (lib/nekorekten.ts starts it with the kind's label). */
export function externalFailReason(error: string | null | undefined): string {
  const e = String(error ?? "");
  if (/IP не е в белия списък|HTTP 403/.test(e)) return "IP не е в белия списък";
  if (/грешен ключ|HTTP 401/.test(e)) return "грешен ключ";
  if (/недостъпна|няма отговор|мрежова грешка|HTTP 5\d\d/.test(e)) return "недостъпна";
  return e ? e.slice(0, 120) : "недостъпна";
}

/**
 * The external check as one line: "Nekorekten.com: 0 доклада (проверено 12.11.2026)" / "Външна проверка: недостъпна" / "… не е правена".
 * `title` (the tooltip) says WHY it failed: "IP не е в белия списък" (403), "грешен ключ" (401), "недостъпна" (timeout / network).
 */
export function externalLine(r: CustomerRisk | null | undefined, configured: boolean): { text: string; down: boolean; title?: string } {
  if (!configured) return { text: "Външна проверка: не е настроена (липсва NEKOREKTEN_API_KEY)", down: false };
  const e = r?.external;
  if (!e) return { text: "Външна проверка: още не е правена", down: false };
  const failedLast = !!e.errorAt && (!e.checkedAt || Date.parse(e.errorAt) > Date.parse(e.checkedAt));
  const title = failedLast ? `Последна грешка (${bgDate(e.errorAt)}): ${externalFailReason(e.error)}${e.error ? ` — ${e.error}` : ""}` : undefined;
  if (failedLast && e.reports == null) return { text: "Външна проверка: недостъпна", down: true, title };
  const n = e.reports ?? 0;
  const base = `Nekorekten.com: ${n} ${plural(n, "доклад", "доклада")} (проверено ${bgDate(e.checkedAt)})`;
  return failedLast ? { text: `${base} · последната проверка: недостъпна`, down: true, title } : { text: base, down: false };
}

export const INCIDENT_WORD: Record<string, string> = { uncollected: "непотърсена", refused: "отказана" };
export const incidentWord = (kind: string): string => INCIDENT_WORD[kind] ?? "върната";
