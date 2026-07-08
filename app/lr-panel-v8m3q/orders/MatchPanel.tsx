"use client";
import { useState, useTransition } from "react";
import { matchTracking, confirmMatch } from "./actions";
import type { MatchResult } from "@/lib/econt";

function fmtDay(ms: number): string {
  try { return new Date(ms).toLocaleDateString("bg-BG", { day: "numeric", month: "short", timeZone: "Europe/Sofia" }); }
  catch { return ""; }
}

export function MatchPanel() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [msg, setMsg] = useState("");

  const run = () => start(async () => {
    setMsg("");
    try {
      const r = await matchTracking();
      setMsg(r.message);
      if (r.ok && r.result) setResult(r.result);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Грешка при проверката");
    }
  });

  const confirm = (orderId: number, awb: string) => start(async () => {
    try {
      const err = await confirmMatch(orderId, awb);
      if (err) { setMsg(err); return; }
      setResult((cur) => cur ? { ...cur, pending: cur.pending.filter((p) => p.orderId !== orderId) } : cur);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Грешка при потвърждаване");
    }
  });

  return (
    <div style={{ background: "rgba(93,202,165,0.08)", border: "0.5px solid rgba(93,202,165,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button disabled={pending} onClick={run} style={{ background: "#0F6E56", color: "#fff", border: "none", fontSize: 12, padding: "9px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
          {pending ? "Проверявам…" : "↻ Провери за нови тракинг номера от Еконт"}
        </button>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
          {msg || "Дърпа готовите пратки от Еконт и попълва тракинга по телефон + сума + дата."}
        </span>
      </div>

      {result && result.pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "#FAC775", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Възможни съвпадения — потвърди на ръка</div>
          {result.pending.map((p) => (
            <div key={p.orderId} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(250,199,117,0.35)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ color: "#fff", fontSize: 13, marginBottom: 8 }}>
                {p.ref} · {p.name} · {p.phone} · {p.total.toFixed(2)} €
                {p.candidates.length > 1 && <span style={{ color: "#FAC775", marginLeft: 8, fontSize: 12 }}>· {p.candidates.length} пратки с този телефон</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {p.candidates.map((c) => (
                  <div key={c.awb} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{c.awb}</span>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>НП {c.cdAmount.toFixed(2)} € · {fmtDay(c.createdDate)} · {c.status}</span>
                    <button disabled={pending} onClick={() => confirm(p.orderId, c.awb)} style={{ marginLeft: "auto", background: "#0F6E56", color: "#fff", border: "none", fontSize: 12, padding: "6px 12px", borderRadius: 7, cursor: "pointer" }}>Потвърди този</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
