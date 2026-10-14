"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminOrder } from "@/lib/orders";
import { confirmOrder, cancelOrder, markCompleted, markReturned, markRestocked } from "../orders/actions";
import { shipRoOrder } from "./actions";

// Orders from the Romanian test (/ro). Amounts are LEI. Same stock rules as the Bulgarian board: cancelling an order
// that holds stock puts the units back (cancelOrder), a returned parcel is restocked with "Взех пратката".

const FILTERS = [
  { id: "active", label: "За работа", match: (s: string) => s === "new" || s === "confirmed" },
  { id: "shipped", label: "Изпратени", match: (s: string) => s === "shipped" },
  { id: "returning", label: "Връщат се", match: (s: string) => s === "returning" || s === "returned" },
  { id: "done", label: "Приключени", match: (s: string) => s === "completed" || s === "restocked" },
  { id: "cancelled", label: "Отказани", match: (s: string) => s === "cancelled" },
  { id: "all", label: "Всички", match: () => true },
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "Нова", confirmed: "Потвърдена", shipped: "Изпратена", completed: "Доставена", cancelled: "Отказана",
  returning: "Връща се", returned: "Върната", restocked: "Върната на склад",
};

const lei = (n: number | null) => `${Number(n ?? 0).toLocaleString("ro-RO")} lei`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

export function RomaniaBoard({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, orders.filter((o) => f.match(o.status)).length])), [orders]);
  const shown = orders.filter((o) => FILTERS.find((f) => f.id === filter)!.match(o.status));
  const open = orders.filter((o) => o.status === "new" || o.status === "confirmed");
  const toCollect = orders.filter((o) => ["new", "confirmed", "shipped"].includes(o.status)).reduce((s, o) => s + Number(o.total ?? 0), 0);

  const run = (job: () => Promise<string | null>) =>
    start(async () => {
      const err = await job();
      setMsg(err ?? "");
      router.refresh();
    });

  const ship = (o: AdminOrder) => {
    const awb = window.prompt("AWB номер на румънския куриер:");
    if (awb === null) return;
    const url = window.prompt("Линк за проследяване (https://..., по желание):", "") ?? "";
    run(() => shipRoOrder(o.id, awb, url));
  };
  const cancel = (o: AdminOrder) => {
    const reason = window.prompt("Причина за отказ (по желание):", "");
    if (reason === null) return;
    run(() => cancelOrder(o.id, "other", reason));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-sans text-sm tracking-[0.14em] uppercase text-white/80">Румъния · {orders.length} поръчки</h1>
        <p className="font-sans text-xs text-white/40 mt-1">
          Суми в леи (RON), наложен платеж, румънски куриер. За работа: {open.length} · За събиране от куриера (нови + потвърдени + изпратени): {lei(toCollect)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full border font-sans text-xs tracking-wide transition-colors ${filter === f.id ? "bg-white text-[#0a0e1f] border-white" : "border-white/15 text-white/60 hover:text-white"}`}>
            {f.label} · {counts[f.id]}
          </button>
        ))}
      </div>

      {msg && <p className="mb-4 font-sans text-xs text-amber-300 border border-amber-300/20 bg-amber-300/5 px-4 py-3">{msg}</p>}

      {shown.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-20">Няма поръчки в този изглед.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((o) => (
            <div key={o.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-white" style={{ fontFamily: "monospace", fontSize: 13 }}>{o.order_ref}</span>
                  <span className="font-sans text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/70">{STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <span className="font-sans text-xs text-white/40">{fmtDate(o.created_at)}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                <p className="text-white">{o.name}</p>
                <p className="text-white/70">{o.address}, {o.city}{o.post_code ? `, ${o.post_code}` : ""}</p>
                <p>{o.phone && <a href={`tel:${o.phone}`} className="text-[#85B7EB]">{o.phone}</a>}</p>
                <p>{o.email && <a href={`mailto:${o.email}`} className="text-white/60">{o.email}</a>}</p>
              </div>

              <ul className="text-sm text-white/80 mb-3">
                {(o.items ?? []).map((i, k) => (
                  <li key={k}>{i.name} × {i.quantity ?? i.qty ?? 1} <span className="text-white/40">· {lei(i.price ?? 0)}</span></li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-sans text-sm text-white">
                  За плащане: <strong>{lei(o.total)}</strong>
                  <span className="text-white/40"> (доставка {Number(o.shipping_cost ?? 0) === 0 ? "безплатна" : lei(o.shipping_cost)})</span>
                  {o.tracking_number && <span className="text-white/50 ml-3">AWB {o.tracking_number}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {o.status === "new" && <Btn onClick={() => run(() => confirmOrder(o.id))} disabled={pending} tone="go">Потвърди</Btn>}
                  {o.status === "confirmed" && <Btn onClick={() => ship(o)} disabled={pending} tone="go">Изпратена + AWB</Btn>}
                  {o.status === "shipped" && <Btn onClick={() => run(() => markCompleted(o.id))} disabled={pending} tone="go">Доставена</Btn>}
                  {o.status === "shipped" && <Btn onClick={() => run(() => markReturned(o.id))} disabled={pending}>Върната / отказана</Btn>}
                  {o.status === "returning" && <Btn onClick={() => run(() => markRestocked(o.id))} disabled={pending} tone="go">Взех пратката</Btn>}
                  {(o.status === "new" || o.status === "confirmed") && <Btn onClick={() => cancel(o)} disabled={pending} tone="bad">Откажи</Btn>}
                </div>
              </div>
              {o.notes && <p className="mt-3 font-sans text-xs text-white/50">Бележка на клиента: {o.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: "go" | "bad" }) {
  const cls = tone === "go" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : tone === "bad" ? "bg-red-500/10 border-red-500/30 text-red-300" : "border-white/20 text-white/70";
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-md border font-sans text-xs tracking-wide disabled:opacity-40 ${cls}`}>{children}</button>;
}
