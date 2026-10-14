"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminOrder } from "@/lib/orders";
import { confirmOrder, cancelOrder, markCompleted, markReturned, markRestocked } from "../orders/actions";
import { shipRoOrder } from "./actions";
import { isPendingPayment, isDeadCardAttempt, isUnpaidCardAttempt, matchesPayment, type PayMethodFilter, type PayStateFilter } from "@/lib/order-status";
import { isCard, isPaidCard } from "@/lib/payments";
import { PaymentBadge, PaymentFilters, PaidCardCollectLine } from "../orders/PaymentUi";

// Orders from the Romanian test (/ro). Amounts are LEI. Same stock rules as the Bulgarian board: cancelling an order
// that holds stock puts the units back (cancelOrder), a returned parcel is restocked with "Взех пратката".
// Payment: cash on delivery or card (Stripe). A PAID card order is collected as 0 by the courier. Unpaid card attempts
// (status pending_payment, or cancelled with payment_status expired/failed) are not orders: they are kept out of every
// list and counter below and shown only under the "Чакат плащане" chip, read-only.

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
  returning: "Връща се", returned: "Върната", restocked: "Върната на склад", pending_payment: "Чака плащане",
};

const lei = (n: number | null) => `${Number(n ?? 0).toLocaleString("ro-RO")} lei`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

export function RomaniaBoard({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [showPending, setShowPending] = useState(false);   // the "Чакат плащане" chip view
  const [showDead, setShowDead] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodFilter>("all");
  const [payState, setPayState] = useState<PayStateFilter>("all");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const openAttempts = useMemo(() => orders.filter(isPendingPayment), [orders]);
  const deadAttempts = useMemo(() => orders.filter((o) => isUnpaidCardAttempt(o) && !isPendingPayment(o)), [orders]);
  // Real orders only (no unpaid card attempts); the payment filters narrow the tabs and their counters.
  const sales = useMemo(() => orders.filter((o) => !isUnpaidCardAttempt(o)), [orders]);
  const real = useMemo(() => sales.filter((o) => matchesPayment(o, payMethod, payState)), [sales, payMethod, payState]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, real.filter((o) => f.match(o.status)).length])), [real]);
  const shown = real.filter((o) => FILTERS.find((f) => f.id === filter)!.match(o.status));
  const listed = showPending ? [...openAttempts, ...(showDead ? deadAttempts : [])] : shown;
  const open = sales.filter((o) => o.status === "new" || o.status === "confirmed");
  // What the courier still has to collect: a PAID card order contributes 0.
  const toCollect = sales.filter((o) => ["new", "confirmed", "shipped"].includes(o.status) && !isPaidCard(o)).reduce((s, o) => s + Number(o.total ?? 0), 0);

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
    const reason = window.prompt(`${isPaidCard(o) ? "ВНИМАНИЕ: платена с карта - след отказа върни сумата от Stripe.\n" : ""}Причина за отказ (по желание):`, "");
    if (reason === null) return;
    run(() => cancelOrder(o.id, "other", reason));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-sans text-sm tracking-[0.14em] uppercase text-white/80">Румъния · {orders.length} поръчки</h1>
        <p className="font-sans text-xs text-white/40 mt-1">
          Суми в леи (RON), наложен платеж или карта, румънски куриер. За работа: {open.length} · За събиране от куриера (нови + потвърдени + изпратени, без платените с карта): {lei(toCollect)}
        </p>
      </div>

      <div className="mb-4">
        <PaymentFilters method={payMethod} state={payState} onMethod={setPayMethod} onState={setPayState} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => { setFilter(f.id); setShowPending(false); }}
            className={`px-4 py-2 rounded-full border font-sans text-xs tracking-wide transition-colors ${!showPending && filter === f.id ? "bg-white text-[#0a0e1f] border-white" : "border-white/15 text-white/60 hover:text-white"}`}>
            {f.label} · {counts[f.id]}
          </button>
        ))}
        {/* Unpaid card attempts: not orders, read-only, shown only here */}
        {(openAttempts.length > 0 || deadAttempts.length > 0 || showPending) && (
          <button onClick={() => setShowPending(true)}
            className={`px-3 py-2 rounded-full border border-dashed font-sans text-[11px] tracking-wide transition-colors ${showPending ? "border-amber-300 text-amber-300 bg-amber-300/10" : "border-white/25 text-white/50 hover:text-white"}`}>
            Чакат плащане · {openAttempts.length}
          </button>
        )}
      </div>

      {msg && <p className="mb-4 font-sans text-xs text-amber-300 border border-amber-300/20 bg-amber-300/5 px-4 py-3">{msg}</p>}

      {showPending && (
        <div className="mb-4">
          <p className="font-sans text-xs text-white/50">
            Незавършени плащания с карта. Не са поръчки: наличността е резервирана и се връща автоматично, ако клиентът не плати.
          </p>
          {deadAttempts.length > 0 && (
            <button onClick={() => setShowDead((v) => !v)} className="mt-2 font-sans text-xs text-white/40 hover:text-white/70">
              {showDead ? "▾" : "▸"} {deadAttempts.length} изтекли / неуспешни плащания (не са поръчки)
            </button>
          )}
        </div>
      )}

      {listed.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-20">{showPending ? "Няма чакащи плащания." : "Няма поръчки в този изглед."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {listed.map((o) => (
            <div key={o.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-white" style={{ fontFamily: "monospace", fontSize: 13 }}>{o.order_ref}</span>
                  <span className="font-sans text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-white/70">{isDeadCardAttempt(o) ? "Неплатена · изтекла" : (STATUS_LABEL[o.status] ?? o.status)}</span>
                  <PaymentBadge order={o} />
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
                {isPaidCard(o) ? (
                  <div>
                    <PaidCardCollectLine zero="0 лей" paidAmount={lei(o.total)} paidAt={o.paid_at ? fmtDate(o.paid_at) : null} />
                    {o.tracking_number && <p className="font-sans text-sm text-white/50 mt-1">AWB {o.tracking_number}</p>}
                  </div>
                ) : (
                  <p className="font-sans text-sm text-white">
                    {isCard(o) ? "Сума (карта, още не е платено)" : "За плащане"}: <strong>{lei(o.total)}</strong>
                    <span className="text-white/40"> (доставка {Number(o.shipping_cost ?? 0) === 0 ? "безплатна" : lei(o.shipping_cost)})</span>
                    {o.tracking_number && <span className="text-white/50 ml-3">AWB {o.tracking_number}</span>}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {o.status === "new" && <Btn onClick={() => run(() => confirmOrder(o.id))} disabled={pending} tone="go">Потвърди</Btn>}
                  {o.status === "confirmed" && <Btn onClick={() => ship(o)} disabled={pending} tone="go">Изпратена + AWB</Btn>}
                  {o.status === "shipped" && <Btn onClick={() => run(() => markCompleted(o.id))} disabled={pending} tone="go">Доставена</Btn>}
                  {o.status === "shipped" && <Btn onClick={() => run(() => markReturned(o.id))} disabled={pending}>Върната / отказана</Btn>}
                  {o.status === "returning" && <Btn onClick={() => run(() => markRestocked(o.id))} disabled={pending} tone="go">Взех пратката</Btn>}
                  {(o.status === "new" || o.status === "confirmed") && <Btn onClick={() => cancel(o)} disabled={pending} tone="bad">Откажи</Btn>}
                </div>
              </div>
              {isPendingPayment(o) && <p className="mt-3 font-sans text-xs text-amber-300">Клиентът още не е платил - резервирана наличност, изтича автоматично</p>}
              {isDeadCardAttempt(o) && <p className="mt-3 font-sans text-xs text-white/50">Плащането с карта не е завършено - не е поръчка, наличността е върната</p>}
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
