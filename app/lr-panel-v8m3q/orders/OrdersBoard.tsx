"use client";
import { useState } from "react";
import { OrderCard } from "./OrderCard";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";

type Filter = "all" | "new" | "stuck" | "confirmed";

const FILTER_LABEL: Record<Filter, string> = {
  all: "", new: "Непотвърдени", stuck: "Над 24 часа", confirmed: "За изпълнение",
};

export function OrdersBoard({
  orders, histories, log, nowMs,
}: {
  orders: AdminOrder[];
  histories: Record<string, CustomerHistory>;
  log: Record<number, StatusLogRow[]>;
  nowMs: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const ageH = (o: AdminOrder) => (nowMs - new Date(o.created_at).getTime()) / 3_600_000;
  const isNew = (o: AdminOrder) => o.status === "new" && !o.excluded_from_stock;

  const newCount       = orders.filter(isNew).length;
  const stuckCount     = orders.filter((o) => isNew(o) && ageH(o) > 24).length;
  const confirmedCount = orders.filter((o) => o.status === "confirmed" && !o.excluded_from_stock).length;

  const filtered = orders.filter((o) => {
    if (filter === "new") return isNew(o);
    if (filter === "stuck") return isNew(o) && ageH(o) > 24;
    if (filter === "confirmed") return o.status === "confirmed" && !o.excluded_from_stock;
    return true;
  });

  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  return (
    <>
      {/* Summary bar */}
      <div className="border-b border-white/6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex gap-2.5 items-stretch flex-wrap">
          <Chip active={filter === "stuck"}     onClick={() => toggle("stuck")}     count={stuckCount}     title="Над 24 часа"   sub="заседнали · обработи спешно" accent="#A32D2D"                  fg="#F09595" bg="rgba(163,45,45,0.16)" strong />
          <Chip active={filter === "new"}       onClick={() => toggle("new")}       count={newCount}       title="Непотвърдени"  sub="за обаждане"                accent="rgba(255,255,255,0.12)" fg="#FAC775" />
          <Chip active={filter === "confirmed"} onClick={() => toggle("confirmed")} count={confirmedCount} title="За изпълнение" sub="чакат пакетиране"           accent="rgba(255,255,255,0.12)" fg="#97C459" />
          <span className="ml-auto self-center text-white/25 text-[11px] hidden sm:block">клик = филтрирай списъка</span>
        </div>
      </div>

      {/* Active filter hint */}
      {filter !== "all" && (
        <div className="max-w-5xl mx-auto px-6 pt-3 flex items-center gap-2 text-white/40 text-[11px]">
          <button
            onClick={() => setFilter("all")}
            style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}
          >
            Филтър: {FILTER_LABEL[filter]} ✕
          </button>
          <span>· показани {filtered.length} от {orders.length}</span>
        </div>
      )}

      {/* List */}
      <main className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4">
        {filtered.length === 0 && (
          <p className="text-white/40 text-sm text-center py-16">Няма поръчки за показване.</p>
        )}
        {filtered.map((o) => (
          <OrderCard key={o.id} order={o} history={o.phone ? histories[o.phone] : undefined} log={log[o.id]} />
        ))}
      </main>
    </>
  );
}

function Chip({
  count, title, sub, accent, fg, bg, active, strong, onClick,
}: {
  count: number; title: string; sub: string; accent: string; fg: string; bg?: string; active: boolean; strong?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        background: active ? "rgba(255,255,255,0.09)" : (bg ?? "rgba(255,255,255,0.03)"),
        border: `0.5px solid ${active ? "#fff" : accent}`,
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
