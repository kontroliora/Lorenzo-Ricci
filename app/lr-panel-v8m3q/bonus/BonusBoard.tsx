import type { BonusData } from "@/lib/bonus";

function fmtDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "short", timeZone: "Europe/Sofia" });
  } catch { return iso; }
}
function fmtRange(startISO: string, endISO: string): string {
  const y = new Date(endISO).getFullYear();
  return `${fmtDay(startISO)} – ${fmtDay(endISO)} ${y}`;
}

export function BonusBoard({ data }: { data: BonusData }) {
  const { rate, current, history, totalPaid } = data;
  const daysToReset = Math.max(0, Math.ceil((new Date(current.periodEnd).getTime() - Date.now()) / 86_400_000));
  const maxAmount = Math.max(1, ...history.map((h) => h.amount));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">

      {/* Current period */}
      <div style={{ background: "rgba(151,196,89,0.08)", border: "0.5px solid rgba(151,196,89,0.3)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ color: "#97C459", fontSize: 18 }}>◈</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: "0.05em" }}>Бонус · текущ период</span>
        </div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.85)" }}>
          Взети пратки този период: <span style={{ color: "#fff", fontWeight: 500 }}>{current.count}</span> × {rate.toFixed(2)} € ={" "}
          <span style={{ color: "#97C459", fontWeight: 500, fontSize: 26, marginLeft: 4 }}>{current.amount.toFixed(2)} €</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.45)", flexWrap: "wrap" }}>
          <span>{fmtRange(current.periodStart, current.periodEnd)}</span>
          <span style={{ marginLeft: "auto" }}>↻ нулира се на 5-то число (след {daysToReset} {daysToReset === 1 ? "ден" : "дни"})</span>
        </div>
      </div>

      {/* Parcels earning the bonus */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>Взети пратки, които носят бонус</div>
        {current.parcels.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, padding: "6px 0" }}>
            Още няма пратки, потвърдени като доставени от Еконт този период. Бонусът ще започне да расте
            автоматично щом Еконт следенето отбележи първата взета пратка.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {current.parcels.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
                <span style={{ color: "#97C459", fontSize: 15 }}>✓</span>
                <span style={{ color: "rgba(255,255,255,0.45)", width: 60 }}>{fmtDay(p.completed_at)}</span>
                <span style={{ color: "#fff", flex: 1, minWidth: 0 }}>{p.name || "—"}</span>
                <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 11 }}>{p.tracking_number || "—"}</span>
                <span style={{ color: "#97C459", width: 52, textAlign: "right" }}>+{rate.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integrity note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(133,183,235,0.08)", border: "0.5px solid rgba(133,183,235,0.25)", borderRadius: 10, padding: "11px 14px" }}>
        <span style={{ color: "#85B7EB", fontSize: 16, flexShrink: 0 }}>⛨</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          Брои се само пратка, потвърдена като <span style={{ color: "#85B7EB" }}>„Доставена" от Еконт</span> — не от ръчно маркиране. Затова числото е точно и не може да се манипулира.
        </span>
      </div>

      {/* History */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Минали периоди (архив)</div>
        {history.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Няма архивирани периоди още.</div>
        ) : (
          <>
            {history.map((h) => (
              <div key={h.key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", width: 60 }}>{h.label}</span>
                <div style={{ flex: 1, height: 7, background: "rgba(151,196,89,0.15)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((h.amount / maxAmount) * 100)}%`, height: "100%", background: "#97C459" }} />
                </div>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 500, width: 64, textAlign: "right" }}>{h.amount.toFixed(2)} €</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(255,255,255,0.08)", fontSize: 13 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Общо изплатено (архив)</span>
              <span style={{ color: "#fff", fontWeight: 500 }}>{totalPaid.toFixed(2)} €</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
