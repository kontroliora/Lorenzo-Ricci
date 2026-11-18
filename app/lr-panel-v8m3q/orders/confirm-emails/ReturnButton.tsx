"use client";
import { useState, useTransition } from "react";
import { returnToCallQueue } from "./actions";

export const SCANNER_NOTE = "потвърдена в същата минута – вероятно скенер, обадете се";

export function ReturnToQueueButton({ orderId }: { orderId: number }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (msg) return <span data-testid="return-msg" style={{ fontSize: 12, color: "#C0DD97" }}>{msg}</span>;
  return (
    <button data-testid={`return-${orderId}`} disabled={pending} onClick={() => start(async () => setMsg(await returnToCallQueue(orderId, SCANNER_NOTE)))}
      style={{ background: "transparent", color: "#FAC775", border: "1px solid #FAC775", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", marginLeft: 6 }}>
      ↩ Върни в опашката
    </button>
  );
}
