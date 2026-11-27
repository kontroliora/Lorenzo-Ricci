"use client";
// Некоректни клиенти (27.11.2026): the red row, the НЕКОРЕКТЕН / ВНИМАНИЕ badge, the "НЕКОРЕКТЕН КЛИЕНТ" band with the full history,
// the manual mark, "Провери отново" and "Докладвай в Nekorekten" (with a confirm dialog that shows exactly what is sent).
import { useState, useTransition, type CSSProperties } from "react";
import type { AdminOrder } from "@/lib/orders";
import { isReturn } from "@/lib/order-status";
import { whoName } from "@/lib/admin-names";
import {
  riskLevel, riskReason, externalLine, internalReason, incidentWord, bgDate, type CustomerRisk, type RiskLevel,
} from "@/lib/customer-risk-shared";
import { recheckExternal, setCustomerFlag, previewNekorektenReport, sendNekorektenReport, type ReportPreview } from "./risk-actions";

export const RISK_RED = "#E24B4A";
export const RISK_ORANGE = "#EF8A17";

/** The whole card/row: light red background + red border on the left (bad), orange left border (warn). Merged over the card's own style. */
export function riskCardStyle(level: RiskLevel): CSSProperties {
  if (level === "bad") return { background: "rgba(226,75,74,0.16)", borderLeft: `5px solid ${RISK_RED}`, boxShadow: "inset 0 0 0 1px rgba(240,149,149,0.35)" };
  if (level === "warn") return { borderLeft: `5px solid ${RISK_ORANGE}` };
  return {};
}

/** Badge next to the name + the small reason under it. Nothing for a normal customer. */
export function RiskBadge({ risk }: { risk?: CustomerRisk | null }) {
  const level = riskLevel(risk);
  if (!level || !risk) return null;
  const bad = level === "bad";
  return (
    <div data-risk={level} style={{ marginTop: 6 }}>
      <span style={{ display: "inline-block", background: bad ? RISK_RED : RISK_ORANGE, color: "#fff", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", padding: "3px 10px", borderRadius: 6 }}>
        {bad ? "НЕКОРЕКТЕН" : "ВНИМАНИЕ"}
      </span>
      <div style={{ color: bad ? "#F7B4B4" : "#F8C58A", fontSize: 11.5, marginTop: 4 }}>{riskReason(risk)}</div>
    </div>
  );
}

const btn = (color: string): CSSProperties => ({ background: "transparent", border: `0.5px solid ${color}`, color, fontSize: 11.5, padding: "5px 11px", borderRadius: 7, cursor: "pointer" });

/**
 * The detail part on the order card. Bad -> the red band with the full history (links to the old orders) + external reports.
 * Otherwise a quiet line with the external check. Always: "Провери отново" and the manual mark; "Докладвай" on a returned parcel.
 */
export function RiskPanel({
  order, risk, role, extConfigured, onFocusOrder, onNotice,
}: {
  order: AdminOrder; risk?: CustomerRisk | null; role?: string; extConfigured: boolean;
  onFocusOrder?: (ref: string) => void; onNotice?: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [report, setReport] = useState<ReportPreview | null>(null);
  if (!order.phone) return null;
  const level = riskLevel(risk);
  const ext = externalLine(risk, extConfigured);
  const flagged = !!risk?.manual?.flagged;
  const canReport = role === "owner" && isReturn(order.status);

  const recheck = () => start(async () => {
    setMsg("");
    const r = await recheckExternal(order.id);
    setMsg(r.message);
  });
  const saveFlag = () => start(async () => {
    const err = await setCustomerFlag(order.id, !flagged, flagNote);
    if (err) { setMsg(err); if (/^Записът/.test(err)) onNotice?.(err); return; }
    setFlagOpen(false); setFlagNote(""); setMsg(flagged ? "Маркировката е премахната." : "Клиентът е маркиран като некоректен.");
  });
  const openReport = () => start(async () => { setMsg(""); setReport(await previewNekorektenReport(order.id)); });

  const controls = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      {extConfigured && <button disabled={pending} onClick={recheck} style={btn("rgba(255,255,255,0.55)")}>{pending ? "…" : "Провери отново"}</button>}
      <button disabled={pending} onClick={() => { setFlagOpen((v) => !v); setMsg(""); }} style={btn(flagged ? "#97C459" : "#F09595")}>
        {flagged ? "Премахни маркировката" : "Маркирай като некоректен"}
      </button>
      {canReport && extConfigured && <button disabled={pending} onClick={openReport} style={{ ...btn("#fff"), background: RISK_RED, border: "none", fontWeight: 600 }}>Докладвай в Nekorekten</button>}
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      {level === "bad" && risk ? (
        <div data-testid="risk-band" style={{ background: "rgba(226,75,74,0.22)", border: `1px solid ${RISK_RED}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.08em", fontSize: 13 }}>⛔ НЕКОРЕКТЕН КЛИЕНТ</div>
          <div style={{ color: "#F7D0D0", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            {internalReason(risk) && <div>Наши пратки: {internalReason(risk)} · успешни поръчки: {risk.completed}</div>}
            {risk.incidents.map((i) => (
              <div key={i.id}>
                · {bgDate(i.at)} — {incidentWord(i.kind)}{i.site === "chronobg" ? " (CHRONOBG)" : ""} —{" "}
                {i.id === order.id ? <span style={{ color: "#fff" }}>{i.ref ?? `#${i.id}`} (тази)</span> : (
                  <button onClick={() => i.ref && onFocusOrder?.(i.ref)} style={{ background: "none", border: "none", padding: 0, color: "#fff", textDecoration: "underline", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>{i.ref ?? `#${i.id}`}</button>
                )}
              </div>
            ))}
            {risk.manual?.flagged && <div>Ръчно маркиран{risk.manual.by ? ` от ${whoName(risk.manual.by)}` : ""}{risk.manual.at ? `, ${bgDate(risk.manual.at)}` : ""}: „{risk.manual.note}“</div>}
            <div style={{ color: ext.down ? "#FAC775" : "#F7D0D0" }}>{ext.text}</div>
          </div>
          {controls}
        </div>
      ) : (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
          <div style={{ color: level === "warn" ? "#F8C58A" : ext.down ? "#FAC775" : "rgba(255,255,255,0.45)", fontSize: 11.5 }}>
            {ext.text}{level === "warn" ? " — нямаме наши непотърсени/отказани пратки" : ""}
            {risk?.manual && !risk.manual.flagged ? ` · маркировката е премахната (${whoName(risk.manual.by)}): „${risk.manual.note}“` : ""}
          </div>
          {controls}
        </div>
      )}
      {flagOpen && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input value={flagNote} onChange={(e) => setFlagNote(e.target.value)} placeholder={flagged ? "Защо премахвате маркировката?" : "Бележка: защо е некоректен?"} maxLength={500}
            style={{ flex: 1, minWidth: 200, background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 10px" }} />
          <button disabled={pending || !flagNote.trim()} onClick={saveFlag} style={{ ...btn("#fff"), background: flagged ? "#3B6D11" : RISK_RED, border: "none" }}>{flagged ? "Премахни" : "Маркирай"}</button>
        </div>
      )}
      {msg && <div role="status" style={{ color: "#FAC775", fontSize: 11.5, marginTop: 6 }}>{msg}</div>}
      {report && <ReportDialog orderId={order.id} preview={report} onClose={(m) => { setReport(null); if (m) setMsg(m); }} />}
    </div>
  );
}

/** The confirm dialog: shows the exact JSON that goes to Nekorekten.com. Nothing is sent before "Изпрати доклада". */
function ReportDialog({ orderId, preview, onClose }: { orderId: number; preview: ReportPreview; onClose: (msg?: string) => void }) {
  const [text, setText] = useState(preview.ok ? preview.defaultText : "");
  const [withEmail, setWithEmail] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const payload = preview.ok ? { ...preview.payload, text: text.trim(), ...(withEmail && preview.email ? { email: preview.email } : {}) } : null;

  const send = () => start(async () => {
    setErr("");
    const r = await sendNekorektenReport(orderId, text, withEmail);
    if (r.ok) onClose(r.message); else setErr(r.message);
  });

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#141a33", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Докладвай в Nekorekten.com</div>
        {!preview.ok ? (
          <p style={{ color: "#F09595", fontSize: 13, marginTop: 10 }}>{preview.message}</p>
        ) : (
          <>
            {preview.alreadySent && <p style={{ color: "#FAC775", fontSize: 12.5, marginTop: 8 }}>Тази пратка вече е докладвана на {preview.alreadySent}. Нов доклад няма да бъде изпратен.</p>}
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 8 }}>Ще бъдат изпратени ТОЧНО тези данни (публичен сигнал в Nekorekten.com):</p>
            <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 10 }}>Описание (text)</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000}
              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 10px", marginTop: 4 }} />
            {preview.email && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 8 }}>
                <input type="checkbox" checked={withEmail} onChange={(e) => setWithEmail(e.target.checked)} /> Изпрати и имейла на клиента
              </label>
            )}
            <pre data-testid="report-payload" style={{ background: "rgba(0,0,0,0.35)", color: "#CFE3F7", fontSize: 11.5, padding: 10, borderRadius: 8, marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(payload, null, 2)}</pre>
          </>
        )}
        {err && <p style={{ color: "#F09595", fontSize: 12.5, marginTop: 8 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => onClose()} disabled={pending} style={btn("rgba(255,255,255,0.6)")}>Отказ</button>
          {preview.ok && !preview.alreadySent && (
            <button onClick={send} disabled={pending || text.trim().length < 10} style={{ ...btn("#fff"), background: RISK_RED, border: "none", fontWeight: 600 }}>
              {pending ? "Изпращане…" : "Изпрати доклада"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
