// Who did it, as the team says it (owner, 27.11.2026): "Отказва – Давид, 27.11 14:32". Client-safe (no server imports).
// order_status_log.changed_by_email holds the admin's e-mail, or a word the system writes itself ("система", "клиентът ...").

const NAMES: Record<string, string> = {
  "sodolos3@gmail.com": "Давид",
  "protatatos@gmail.com": "Коко",
};

export const PARTNER_NAME = "Деивид";

export function whoName(email: string | null | undefined): string {
  const e = String(email ?? "").trim();
  if (!e) return "автоматично";
  const known = NAMES[e.toLowerCase()];
  if (known) return known;
  if (!e.includes("@")) return e;            // "система", "клиентът (линк в имейла)"
  return e.split("@")[0];
}

/** "27.11 14:32" in Sofia time. */
export function shortWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d).reduce<Record<string, string>>((m, x) => (m[x.type] = x.value, m), {});
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

// The log's raw values -> what a person reads.
const STATUS_WORD: Record<string, string> = {
  new: "Нова", confirmed: "Потвърдена", shipped: "Изпратена", completed: "Доставена", cancelled: "Отказва",
  returning: "Връща се", restocked: "Върната в склада", returned: "Върната", pending_payment: "Чака плащане",
};
export type LogLike = { old_status: string | null; new_status: string | null; changed_by_email: string | null; changed_at: string };

/** One history row as a short line, e.g. "Отказва", "Не вдига (опит #2)", "Товарителница: създадена № 105…". */
export function actionText(r: LogLike): string {
  const o = r.old_status ?? "";
  const n = r.new_status ?? "";
  if (o === "не вдига") return `Не вдига (${n})`;
  if (o === "коментар") return `Коментар: ${n}`.slice(0, 120);
  if (o === "тракинг №") return `Тракинг № ${n}`;
  if (o === "товарителница") return `Товарителница: ${n}`;
  if (o === "маркиране") return `Маркирана: ${n}`;
  if (o === "върната стока") return `Върната стока: ${n}`;
  if (o === "печат") return `Печат: ${n}`;
  if (o === "партньор") return `(партньор) ${n}`;
  return STATUS_WORD[n] ?? n;
}

/** "Отказва – Давид, 27.11 14:32" */
export const actionLine = (r: LogLike): string => `${actionText(r)} – ${whoName(r.changed_by_email)}, ${shortWhen(r.changed_at)}`;
