"use client";
import { useState, useTransition } from "react";
import { createTestOrder, deleteTestOrders } from "./actions";

const btn = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" });

export function TestOrderButtons({ hasTest }: { hasTest: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
      <button disabled={pending} style={btn("#1d3b66", "#fff")} onClick={() => start(async () => setMsg(await createTestOrder()))}>+ Тестова поръчка (с моя имейл)</button>
      {hasTest && <button disabled={pending} style={btn("#7a1d1d", "#fff")} onClick={() => start(async () => setMsg(await deleteTestOrders()))}>Изтрий тестовите поръчки</button>}
      {msg && <span data-testid="test-order-msg" style={{ fontSize: 12, color: "#C0DD97" }}>{msg}</span>}
    </div>
  );
}
