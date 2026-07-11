import { getRawStatuses } from "@/lib/econt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Проследяване на пратка · Lorenzo Ricci", robots: "noindex" };

type RawEvent = { destinationType?: string; destinationDetails?: string; officeName?: string; time?: number };

function sofia(ms?: number): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: "Europe/Sofia", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ms));
}

const NAVY = "#0a0e1f";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f0e8", padding: "48px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", background: "#fff", boxShadow: "0 2px 24px rgba(15,12,8,.09)" }}>
        <div style={{ background: NAVY, padding: "30px 40px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#fff", fontFamily: "Georgia, serif", letterSpacing: ".14em", fontSize: 18 }}>LORENZO RICCI</p>
          <p style={{ margin: "6px 0 0", color: "#b0a898", fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase" }}>Проследяване на пратка</p>
        </div>
        <div style={{ height: 2, background: "linear-gradient(to right,#b8944a,#d4af6a,#e8c878,#d4af6a,#b8944a)" }} />
        <div style={{ padding: "36px 40px 44px" }}>{children}</div>
      </div>
    </main>
  );
}

export default async function TrackPage({ params }: { params: Promise<{ awb: string }> }) {
  const { awb } = await params;
  const clean = decodeURIComponent(awb).replace(/\s+/g, "");

  let status: Record<string, unknown> | null = null;
  try {
    const map = await getRawStatuses([clean]);
    status = (map.get(clean) as Record<string, unknown>) ?? null;
  } catch {
    status = null;
  }

  if (!status) {
    return (
      <Shell>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 20, color: NAVY, margin: "0 0 10px" }}>Пратка {clean}</p>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          Все още няма информация за тази пратка. Ако току-що е изпратена, проверете отново след няколко часа. При въпроси ни пишете на info@lorenzo-ricci.com.
        </p>
      </Shell>
    );
  }

  const events = (Array.isArray(status.trackingEvents) ? status.trackingEvents : []) as RawEvent[];
  const shortStatus = String(status.shortDeliveryStatus ?? "В обработка");
  const delivered = status.deliveryTime != null;
  const timeline = [...events].reverse().filter((e) => e.destinationType !== "prepared" || events.length === 1);

  return (
    <Shell>
      <p style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "#888", margin: "0 0 6px" }}>Тракинг номер</p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 22, color: NAVY, margin: "0 0 22px" }}>{clean}</p>

      <div style={{ background: delivered ? "#eef4ee" : "#f4f1ea", border: `1px solid ${delivered ? "#cfe0cf" : "#e8dfc8"}`, padding: "16px 20px", marginBottom: 30 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#888" }}>Текущ статус</p>
        <p style={{ margin: "4px 0 0", fontSize: 17, color: NAVY, fontFamily: "Georgia, serif" }}>{shortStatus}</p>
      </div>

      <p style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "#888", margin: "0 0 16px" }}>История</p>
      <div>
        {timeline.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 14, paddingBottom: i === timeline.length - 1 ? 0 : 18 }}>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: i === 0 ? "#b8944a" : "#d8d0c2", marginTop: 5 }} />
              {i !== timeline.length - 1 && <span style={{ width: 1, flex: 1, background: "#e8dfc8", marginTop: 3 }} />}
            </div>
            <div style={{ paddingBottom: 2 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#a8a09a" }}>{sofia(e.time)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, color: i === 0 ? NAVY : "#555", lineHeight: 1.5 }}>
                {e.destinationDetails ?? ""}{e.officeName ? ` · ${e.officeName}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 32, paddingTop: 22, borderTop: "1px solid #e8dfc8", fontSize: 11, color: "#b0a898", textAlign: "center", lineHeight: 1.8 }}>
        Lorenzo Ricci · info@lorenzo-ricci.com
      </p>
    </Shell>
  );
}
