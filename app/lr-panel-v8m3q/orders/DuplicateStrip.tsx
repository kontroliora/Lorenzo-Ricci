"use client";
// "⚠ Повторна ×N" on an order card: the badge, the banner ("Този клиент има още N поръчки за последните 72ч" + links) and, on a click,
// the whole group (number, date and time, products, total, status) with "Отмени като дубликат" per order and "Не е дубликат" for the group.
// The grouping comes from lib/duplicate-orders.ts (computed in OrdersBoard from the loaded orders).
import { useState, useTransition } from "react";
import type { DupGroup, DupOrder } from "@/lib/duplicate-orders";
import { DUP_WINDOW_HOURS } from "@/lib/duplicate-orders";
import { cancelAsDuplicate, dismissDuplicateGroup } from "./actions";
import { isRoOrder, fmtLei } from "@/lib/market";
import { isPaidCard } from "@/lib/payments";
import type { AdminOrder } from "@/lib/orders";

export const DUP_BG = "rgba(250,199,117,0.10)";
export const DUP_BORDER = "rgba(250,199,117,0.55)";

const STATUS: Record<string, { label: string; fg: string }> = {
  new: { label: "Нова · за обаждане", fg: "#FAC775" },
  confirmed: { label: "За изпълнение", fg: "#97C459" },
  shipped: { label: "Изпратена", fg: "#5DCAA5" },
  completed: { label: "Завършена", fg: "#85B7EB" },
  returned: { label: "Върната", fg: "#F0997B" },
  returning: { label: "Връща се", fg: "#F0997B" },
  restocked: { label: "Върната · в наличност", fg: "#97C459" },
};

const when = (iso: string) => {
  try { return new Date(iso).toLocaleString("bg-BG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" }); }
  catch { return iso; }
};

const productsOf = (o: DupOrder): string =>
  (o.items ?? []).filter((l) => !l.gift).map((l) => `${String(l.name ?? l.slug ?? "—")} ×${Math.max(1, Number(l.quantity ?? l.qty ?? 1))}`).join(", ") || "—";

export function DuplicateStrip({
  group, currentIds, onFocusOrder, onNotice,
}: {
  group: DupGroup;
  currentIds: number[];                         // the order(s) of the card this strip sits on
  onFocusOrder: (ref: string) => void;          // link to another order of the group (the board searches for its number)
  onNotice?: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const n = group.orders.length;
  const others = group.orders.filter((o) => !currentIds.includes(o.id));

  const run = (fn: () => Promise<string | null>) => start(async () => {
    setError("");
    try { const e = await fn(); if (e) { setError(e); onNotice?.(e); } }
    catch (e) { setError(e instanceof Error ? e.message : "Възникна грешка. Опитай пак."); }
  });

  const cancelDup = (o: DupOrder) => {
    if (!window.confirm(`Да откажа ли поръчка #${o.order_ref ?? o.id} като дубликат?\n\nНаличността се връща. Клиентът НЕ получава имейл.`)) return;
    run(() => cancelAsDuplicate(o.id));
  };
  const notDup = () => {
    if (!window.confirm(`Да махна маркировката за тези ${n} поръчки? Повече няма да се броят като повторни.`)) return;
    run(() => dismissDuplicateGroup(group.orders.map((o) => o.id)));
  };

  const money = (o: DupOrder) => {
    const v = Number(o.total ?? 0);
    return isRoOrder(o as AdminOrder) ? fmtLei(v) : `€${v.toFixed(2)}`;
  };
  const link: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: "#85B7EB", fontFamily: "monospace", fontSize: 12, textDecoration: "underline" };

  return (
    <div data-testid="dup-strip" style={{ margin: "10px 0 2px", background: "rgba(250,199,117,0.10)", border: `0.5px solid ${DUP_BORDER}`, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="dup-badge"
          style={{ background: "#FAC775", color: "#3a2a08", border: "none", borderRadius: 20, padding: "4px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          ⚠ Повторна ×{n} {open ? "▴" : "▾"}
        </button>
        {group.sameProducts && (
          <span data-testid="dup-same" style={{ background: "#A32D2D", color: "#fff", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>ЕДНАКВИ ПРОДУКТИ</span>
        )}
        {others.length > 0 && (
          <span style={{ color: "#FAC775", fontSize: 12 }}>
            Този клиент има още {others.length} {others.length === 1 ? "поръчка" : "поръчки"} за последните {DUP_WINDOW_HOURS}ч:{" "}
            {others.map((o, i) => (
              <span key={o.id}>{i > 0 && ", "}<button type="button" style={link} onClick={() => o.order_ref && onFocusOrder(o.order_ref)}>#{o.order_ref ?? o.id}</button></span>
            ))}
          </span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {group.orders.map((o) => {
            const st = STATUS[o.status] ?? { label: o.status, fg: "#fff" };
            const canCancel = (o.status === "new" || o.status === "confirmed") && !isPaidCard(o);
            const isHere = currentIds.includes(o.id);
            return (
              <div key={o.id} style={{ background: "rgba(0,0,0,0.18)", border: `0.5px solid ${isHere ? "rgba(250,199,117,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "8px 10px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.8)" }}>
                  <div>
                    {isHere
                      ? <span style={{ fontFamily: "monospace", color: "#fff" }}>#{o.order_ref ?? o.id} <span style={{ color: "rgba(255,255,255,0.4)" }}>(тази)</span></span>
                      : <button type="button" style={link} onClick={() => o.order_ref && onFocusOrder(o.order_ref)}>#{o.order_ref ?? o.id}</button>}
                    <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 8 }}>{when(o.created_at)}</span>
                    <span style={{ color: st.fg, marginLeft: 8 }}>{st.label}</span>
                    <span style={{ color: "#fff", marginLeft: 8, fontWeight: 500 }}>{money(o)}</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.6)" }}>{productsOf(o)}</div>
                </div>
                {canCancel ? (
                  <button type="button" disabled={pending} onClick={() => cancelDup(o)} data-testid="dup-cancel"
                    style={{ border: "0.5px solid #A32D2D", color: "#F09595", background: "transparent", fontSize: 12, padding: "6px 11px", borderRadius: 8, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
                    Отмени като дубликат
                  </button>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{isPaidCard(o) ? "платена с карта: откажи я отделно" : "не може да се отмени"}</span>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" disabled={pending} onClick={notDup} data-testid="dup-dismiss"
              style={{ border: "0.5px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.05)", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
              Не е дубликат
            </button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>маха маркировката за тази група · „Отмени“ връща наличността и не праща имейл на клиента</span>
          </div>
        </div>
      )}
      {error && <p style={{ color: "#F09595", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
