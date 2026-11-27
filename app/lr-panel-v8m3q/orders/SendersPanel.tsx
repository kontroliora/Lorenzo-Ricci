"use client";
// "Подател по групи" (owner only, 27.11.2026): office (Econt list), person + phone and Econt account per group of orders.
// Loaded when opened; saving writes shipping_senders (its trigger logs who/when). Takes effect on the next label, no deploy.
import { useState, useTransition } from "react";
import { getSenders, saveSender, officeChoices, type SenderEditRow, type SenderLogRow } from "./label-actions";
import { SENDER_GROUPS, type DbAccount, type SenderGroup } from "@/lib/econt-shipping-core";
import { whoName, shortWhen } from "@/lib/admin-names";

const field: React.CSSProperties = { background: "#0a0e1f", border: "0.5px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12 };
const ACCOUNT_TEXT: Record<DbAccount, string> = { lr: "Нашият (Lorenzo Ricci)", chronobg: "CHRONOBG", partner: "На партньора (Деивид)" };

function GroupRow({ row, offices, onSaved }: { row: SenderEditRow; offices: { c: string; n: string; a: string }[]; onSaved: () => void }) {
  const [office, setOffice] = useState(row.econt_office_code ?? "");
  const [filter, setFilter] = useState("");
  const [name, setName] = useState(row.sender_name ?? "");
  const [phone, setPhone] = useState(row.sender_phone ?? "");
  const [account, setAccount] = useState<DbAccount>(row.econt_account);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const label = SENDER_GROUPS.find((g) => g.key === row.sender_group)?.label ?? row.sender_group;
  const shown = offices.filter((o) => o.c === office || !filter || `${o.n} ${o.a} ${o.c}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 80);
  const missing = !office || !name.trim() || !phone.trim();

  return (
    <div style={{ border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>{label}</b>
        {missing && <span style={{ color: "#F09595", fontSize: 11 }}>Няма зададен подател: товарителниците на тази група спират с грешка</span>}
        {row.updated_at && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>последно: {whoName(row.updated_by)}, {shortWhen(row.updated_at)}</span>}
      </div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Търси офис на Еконт (град, име, код)" style={field} />
      <select value={office} onChange={(e) => setOffice(e.target.value)} style={field}>
        <option value="">— няма офис —</option>
        {shown.map((o) => <option key={o.c} value={o.c}>{o.n} ({o.c}) · {o.a}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Подател (име и фамилия)" style={{ ...field, flex: "1 1 180px" }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" inputMode="tel" style={{ ...field, flex: "0 1 150px" }} />
        <select value={account} disabled={row.sender_group === "chronobg"} onChange={(e) => setAccount(e.target.value as DbAccount)} style={{ ...field, flex: "0 1 200px" }}>
          {(row.sender_group === "chronobg" ? ["chronobg"] : ["lr", "partner"]).map((a) => <option key={a} value={a}>{ACCOUNT_TEXT[a as DbAccount]}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button disabled={pending} onClick={() => start(async () => {
          const r = await saveSender({ group: row.sender_group as SenderGroup, office, name, phone, account }).catch((e) => ({ ok: false, message: String(e) }));
          setMsg(r.message); if (r.ok) onSaved();
        })} style={{ border: "0.5px solid #3B6D11", color: "#97C459", background: "transparent", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>Запази</button>
        {msg && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{msg}</span>}
      </div>
    </div>
  );
}

export function SendersPanel() {
  const [data, setData] = useState<{ rows: SenderEditRow[]; log: SenderLogRow[]; message?: string } | null>(null);
  const [offices, setOffices] = useState<{ c: string; n: string; a: string }[]>([]);
  const [pending, start] = useTransition();
  const load = () => start(async () => {
    const [r, o] = await Promise.all([getSenders(), offices.length ? Promise.resolve(offices) : officeChoices(null)]);
    setData(r); setOffices(o);
  });
  return (
    <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !data) load(); }} style={{ margin: "4px 0 12px", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>⚙ Подател по групи (само собственик)</summary>
      {pending && !data && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>зареждам…</p>}
      {data?.message && <p style={{ fontSize: 12, color: "#F09595" }}>{data.message}</p>}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {data.rows.map((r) => <GroupRow key={`${r.sender_group}-${r.updated_at}`} row={r} offices={offices} onSaved={load} />)}
          {data.log.length > 0 && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
              {data.log.map((l, i) => (
                <div key={i}>{shortWhen(l.changed_at)} · {l.sender_group} · {whoName(l.changed_by_email)} · офис {l.old_row?.econt_office_code ?? "—"} → {l.new_row?.econt_office_code ?? "—"}, подател {l.old_row?.sender_name ?? "—"} → {l.new_row?.sender_name ?? "—"}, акаунт {l.old_row?.econt_account ?? "—"} → {l.new_row?.econt_account ?? "—"}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
