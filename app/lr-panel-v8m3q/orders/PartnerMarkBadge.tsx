"use client";
import { useState, useTransition } from "react";
import { PARTNER_MARK_LABEL, applyOfMark, sofiaHM, type PartnerMark } from "@/lib/partner/marks";
import { applyPartnerMark } from "./actions";

const COLORS: Record<string, { bg: string; fg: string }> = {
  called: { bg: "rgba(133,183,235,0.14)", fg: "#85B7EB" }, confirmed: { bg: "rgba(151,196,89,0.14)", fg: "#97C459" },
  no_answer: { bg: "rgba(250,199,117,0.14)", fg: "#FAC775" }, cancelled: { bg: "rgba(240,149,149,0.14)", fg: "#F09595" },
  new: { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.7)" },
};

/** The partner's latest mark on an order ("Партньор: Потвърдено · 21:40" + note) and "Приложи" (sets the real status, logged as you). */
export function PartnerMarkBadge({ id, status, mark, onNotice }: { id: number; status: string; mark: PartnerMark; onNotice?: (m: string) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const c = COLORS[mark.status] ?? COLORS.new;
  const can = applyOfMark(status, mark.status);
  return (
    <div data-testid="partner-mark" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ background: c.bg, color: c.fg, padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>
        Партньор: {PARTNER_MARK_LABEL[mark.status] ?? mark.status} · {sofiaHM(mark.at)}
      </span>
      {mark.note && <span style={{ color: "rgba(255,255,255,0.65)" }}>„{mark.note}“</span>}
      {can && (
        <button disabled={pending}
          onClick={() => start(async () => {
            const e = await applyPartnerMark(id);
            setErr(e ?? ""); if (e) onNotice?.(e);
          })}
          style={{ border: `1px solid ${c.fg}`, color: c.fg, background: "transparent", padding: "2px 10px", borderRadius: 4, fontSize: 12, cursor: "pointer", opacity: pending ? 0.5 : 1 }}>
          {pending ? "…" : `Приложи (${can === "confirm" ? "потвърди" : can === "no_answer" ? "не вдига" : "откажи"})`}
        </button>
      )}
      {err && <span style={{ color: "#F09595" }}>{err}</span>}
    </div>
  );
}
