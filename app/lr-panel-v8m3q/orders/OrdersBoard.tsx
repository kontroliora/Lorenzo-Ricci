"use client";
import { useState, useTransition } from "react";
import { OrderCard } from "./OrderCard";
import { checkEcontStatuses } from "./actions";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";

type Tab = "new" | "confirmed" | "shipped" | "completed" | "returned" | "cancelled";

const TABS: { key: Tab; label: string; accent: string; fg: string; bg: string }[] = [
  { key: "new",       label: "За обаждане",   accent: "#FAC775", fg: "#FAC775", bg: "rgba(250,199,117,0.14)" },
  { key: "confirmed", label: "За изпълнение", accent: "#97C459", fg: "#97C459", bg: "rgba(151,196,89,0.14)" },
  { key: "shipped",   label: "Изпратени",     accent: "#5DCAA5", fg: "#5DCAA5", bg: "rgba(93,202,165,0.14)" },
  { key: "completed", label: "Завършени",     accent: "#85B7EB", fg: "#85B7EB", bg: "rgba(133,183,235,0.14)" },
  { key: "returned",  label: "Върнати",       accent: "#F0997B", fg: "#F0997B", bg: "rgba(240,153,123,0.14)" },
  { key: "cancelled", label: "Отказани",      accent: "#F09595", fg: "#F09595", bg: "rgba(240,149,149,0.14)" },
];

function inTab(o: AdminOrder, tab: Tab): boolean {
  return o.status === tab;
}

export function OrdersBoard({
  orders, histories, log, nowMs,
}: {
  orders: AdminOrder[];
  histories: Record<string, CustomerHistory>;
  log: Record<number, StatusLogRow[]>;
  nowMs: number;
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [showFake, setShowFake] = useState(false);

  const ageH = (o: AdminOrder) => (nowMs - new Date(o.created_at).getTime()) / 3_600_000;

  const real = orders.filter((o) => !o.excluded_from_stock);
  const fake = orders.filter((o) => o.excluded_from_stock);

  const count = (t: Tab) => real.filter((o) => inTab(o, t)).length;
  const stuckCount = real.filter((o) => o.status === "new" && ageH(o) > 24).length;

  const tabOrders = real.filter((o) => inTab(o, tab));
  // "За обаждане" splits into first-call vs re-call (не вдига).
  const fresh  = tabOrders.filter((o) => (o.call_attempts ?? 0) === 0);
  const recall = tabOrders.filter((o) => (o.call_attempts ?? 0) > 0);

  const card = (o: AdminOrder) => (
    <OrderCard key={o.id} order={o} history={o.phone ? histories[o.phone] : undefined} log={log[o.id]} />
  );

  return (
    <>
      {/* Summary — overview over everything; clicking opens the matching sub-tab */}
      <div className="border-b border-white/6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex gap-2.5 items-stretch flex-wrap">
          <Chip onClick={() => setTab("new")}       count={stuckCount}    title="Над 24 часа"   sub="заседнали · обработи спешно" accent="#A32D2D"                  fg="#F09595" bg="rgba(163,45,45,0.16)" strong />
          <Chip onClick={() => setTab("new")}       count={count("new")}       title="Непотвърдени"  sub="за обаждане"                accent="rgba(255,255,255,0.12)" fg="#FAC775" />
          <Chip onClick={() => setTab("confirmed")} count={count("confirmed")} title="За изпълнение" sub="чакат пакетиране"           accent="rgba(255,255,255,0.12)" fg="#97C459" />
          <span className="ml-auto self-center text-white/25 text-[11px] hidden sm:block">клик = отвори подтаба</span>
        </div>
      </div>

      {/* Sub-tabs by status */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.key;
            const c = count(t.key);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: active ? t.bg : "rgba(255,255,255,0.03)",
                  border: `${active ? "1px" : "0.5px"} solid ${active ? t.accent : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 20, padding: "7px 14px", cursor: "pointer",
                  fontSize: 12, color: active ? t.fg : "rgba(255,255,255,0.55)", fontWeight: active ? 500 : 400,
                }}
              >
                {t.label}
                <span style={{ background: active ? t.accent : "rgba(255,255,255,0.1)", color: active ? "#0a0e1f" : "rgba(255,255,255,0.7)", borderRadius: 20, padding: "0 7px", fontSize: 11, fontWeight: 500 }}>{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4">
        {tab === "new" ? (
          <>
            <SectionHeader label={`Нови · за първо обаждане (${fresh.length})`} />
            {fresh.length === 0
              ? <Empty text="Няма нови поръчки за първо обаждане." />
              : fresh.map(card)}

            {recall.length > 0 && (
              <>
                <SectionHeader label={`✆ Чакат повторно обаждане · не вдига (${recall.length})`} color="#FAC775" />
                {recall.map(card)}
              </>
            )}
          </>
        ) : tab === "shipped" ? (
          <>
            <EcontCheck />
            {tabOrders.length === 0
              ? <Empty text="Няма изпратени пратки." />
              : tabOrders.map(card)}
          </>
        ) : tab === "returned" ? (
          <>
            <ReturnsSummary orders={tabOrders} dispatched={count("shipped") + count("completed") + tabOrders.length} />
            {tabOrders.length === 0
              ? <Empty text="Няма върнати пратки." />
              : tabOrders.map(card)}
          </>
        ) : (
          <>
            {tabOrders.length === 0
              ? <Empty text="Няма поръчки в този подтаб." />
              : tabOrders.map(card)}
          </>
        )}

        {/* Fake / test orders — kept out of the working tabs, revealable */}
        {fake.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/6">
            <button
              onClick={() => setShowFake((s) => !s)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", padding: 0 }}
            >
              {showFake ? "▾" : "▸"} {fake.length} маркирани фалшиви / тестови
            </button>
            {showFake && <div className="flex flex-col gap-4 mt-3">{fake.map(card)}</div>}
          </div>
        )}
      </main>
    </>
  );
}

function SectionHeader({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ color: color ?? "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 2 }}>
      {label}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-white/40 text-sm text-center py-12">{text}</p>;
}

function EcontCheck() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = () => start(async () => {
    setMsg("");
    const r = await checkEcontStatuses();
    setMsg(r.message);
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(93,202,165,0.08)", border: "0.5px solid rgba(93,202,165,0.3)", borderRadius: 10, padding: "12px 16px" }}>
      <button
        disabled={pending}
        onClick={run}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#0F6E56", color: "#fff", border: "none", fontSize: 12, padding: "8px 16px", borderRadius: 8, fontWeight: 500, cursor: "pointer", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "Проверявам…" : "↻ Провери статуса от Еконт сега"}
      </button>
      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
        {msg || "Доставените от Еконт автоматично стават завършени и носят бонус."}
      </span>
    </div>
  );
}

function ReturnsSummary({ orders, dispatched }: { orders: AdminOrder[]; dispatched: number }) {
  const total = orders.length;
  const awaiting = orders.filter((o) => o.return_reviewed === false).length;
  const rate = dispatched > 0 ? Math.round((total / dispatched) * 100) : 0;
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", background: "rgba(240,153,123,0.08)", border: "0.5px solid rgba(240,153,123,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13 }}>
      <span style={{ color: "rgba(255,255,255,0.75)" }}>Върнати: <b style={{ color: "#F0997B" }}>{total}</b></span>
      {awaiting > 0 && <span style={{ color: "#FAC775" }}>⏳ чакат преглед: <b>{awaiting}</b></span>}
      <span style={{ color: "rgba(255,255,255,0.5)" }}>процент връщания ~{rate}% <span style={{ color: "rgba(255,255,255,0.3)" }}>от изпратените</span></span>
    </div>
  );
}

function Chip({
  count, title, sub, accent, fg, bg, strong, onClick,
}: {
  count: number; title: string; sub: string; accent: string; fg: string; bg?: string; strong?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        background: bg ?? "rgba(255,255,255,0.03)",
        border: `0.5px solid ${accent}`,
        borderRadius: 10, padding: "10px 16px", cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 500, color: count > 0 ? fg : "rgba(255,255,255,0.3)", lineHeight: 1 }}>{count}</span>
      <span style={{ textAlign: "left", lineHeight: 1.2 }}>
        <span style={{ display: "block", color: strong ? fg : "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: strong ? 500 : 400, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        <span style={{ display: "block", color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{sub}</span>
      </span>
    </button>
  );
}
