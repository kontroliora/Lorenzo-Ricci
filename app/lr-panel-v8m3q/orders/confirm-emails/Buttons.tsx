"use client";
import { useState, useTransition } from "react";
import { sendAllConfirmEmails, sendTestConfirmEmail } from "./actions";

const btn = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, border: "none", borderRadius: 6, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" });

export function ConfirmEmailButtons({ testOrderId, count }: { testOrderId: number | null; count: number }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button disabled={pending || !testOrderId} style={btn("#1d3b66", "#fff")} onClick={() => start(async () => setMsg(await sendTestConfirmEmail(testOrderId!)))}>
          ✉ Тестов имейл до мен
        </button>
        {!armed ? (
          <button disabled={pending || count === 0} style={btn("#3b2f0b", "#FAC775")} onClick={() => setArmed(true)}>
            Изпрати на всички {count}…
          </button>
        ) : (
          <>
            <button disabled={pending} style={btn("#7a1d1d", "#fff")} onClick={() => start(async () => { setMsg(await sendAllConfirmEmails(count)); setArmed(false); })}>
              Да, изпрати на {count} клиента
            </button>
            <button disabled={pending} style={btn("transparent", "rgba(255,255,255,0.6)")} onClick={() => setArmed(false)}>Отказ</button>
          </>
        )}
      </div>
      {pending && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Изпраща се…</div>}
      {msg && <div data-testid="confirm-email-msg" style={{ fontSize: 13, color: "#C0DD97" }}>{msg}</div>}
    </div>
  );
}
