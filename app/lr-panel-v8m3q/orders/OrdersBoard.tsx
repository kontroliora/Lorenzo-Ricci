"use client";
import { useState, useTransition, useEffect } from "react";
import { OrderCard } from "./OrderCard";
import { GroupedOrderCard } from "./GroupedOrderCard";
import { CreateOrderForm } from "./CreateOrderForm";
import { MatchPanel } from "./MatchPanel";
import { PaymentFilters } from "./PaymentUi";
import { checkEcontStatuses } from "./actions";
import type { AdminOrder, CustomerHistory, StatusLogRow } from "@/lib/orders";
import { isReturn, isPendingPayment, isUnpaidCardAttempt, matchesPayment, type PayMethodFilter, type PayStateFilter } from "@/lib/order-status";
import { isCard } from "@/lib/payments";
import { isRoOrder, marketOf, type Market } from "@/lib/market";
import { activeWindow, nextWindow, callTimer } from "@/lib/callSchedule";

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
  // The "Върнати" tab holds both return sub-statuses (returning / restocked) +
  // the legacy value, so returns never vanish after the split.
  if (tab === "returned") return isReturn(o.status);
  return o.status === tab;
}

// --- Search (client-side; runs over every loaded order, all statuses) ---
// Phone match is format-tolerant: strips spaces/+/dashes, drops 359 / leading 0,
// so "0888 123 456", "+359888123456", "888123456" all resolve to one core and
// one phone surfaces the client's whole order history.
function phoneCore(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("359")) d = d.slice(3);
  else if (d.startsWith("40") && d.length >= 11) d = d.slice(2); // +40 7xx xxx xxx (Romania)
  return d.replace(/^0+/, "");
}
// Latin letters + digits only, lowercased — for order ref / tracking, so a dash
// or spaces don't matter ("LR-4B2K9" ↔ "lr4b2k9" ↔ "4b2k9").
function alnum(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function orderMatches(o: AdminOrder, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  // name (keeps Cyrillic)
  if ((o.name ?? "").toLowerCase().includes(q)) return true;
  // product name / slug
  if ((o.items ?? []).some((it) =>
    (it.name ?? "").toLowerCase().includes(q) || (it.slug ?? "").toLowerCase().includes(q)
  )) return true;
  // order ref / tracking number (punctuation-tolerant)
  const qa = alnum(q);
  if (qa) {
    if (alnum(o.order_ref ?? "").includes(qa)) return true;
    if (alnum(o.tracking_number ?? "").includes(qa)) return true;
  }
  // phone (format-tolerant) — only once the query has enough digits to be a phone
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3) {
    const pc = phoneCore(o.phone ?? "");
    const qc = phoneCore(q);
    if (pc && qc && pc.includes(qc)) return true;
  }
  return false;
}

// --- Group same-customer NEW orders (visual only; DB rows stay separate) ---
// Same normalized phone, and each order within 24h of the previous → one cluster.
const DAY_MS = 24 * 3_600_000;
function groupByCustomer(orders: AdminOrder[]): AdminOrder[][] {
  const buckets = new Map<string, AdminOrder[]>();
  const noPhone: AdminOrder[][] = [];
  for (const o of orders) {
    const core = phoneCore(o.phone ?? "");
    const key = core ? `${marketOf(o)}:${core}` : ""; // a Bulgarian and a Romanian order are never merged into one card
    // A card order is never merged either: its courier-collects amount differs from a cash-on-delivery one.
    if (!key || isCard(o)) { noPhone.push([o]); continue; }
    const b = buckets.get(key);
    if (b) b.push(o); else buckets.set(key, [o]);
  }
  const groups: AdminOrder[][] = [];
  for (const arr of buckets.values()) {
    if (arr.length === 1) { groups.push(arr); continue; }
    const sorted = [...arr].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let cluster: AdminOrder[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime() <= DAY_MS) cluster.push(sorted[i]);
      else { groups.push(cluster); cluster = [sorted[i]]; }
    }
    groups.push(cluster);
  }
  const all = [...groups, ...noPhone];
  const newest = (g: AdminOrder[]) => Math.max(...g.map((o) => new Date(o.created_at).getTime()));
  all.sort((a, b) => newest(b) - newest(a)); // newest group first
  return all;
}
// Identical delivery destination? (courier + city + address, normalized)
function addressKey(o: AdminOrder): string {
  return [o.courier ?? "", o.city ?? "", o.address ?? ""].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
}
function sameAddress(g: AdminOrder[]): boolean {
  const k = addressKey(g[0]);
  return g.every((o) => addressKey(o) === k);
}

type MarketFilter = "all" | Market;
const MARKETS: { key: MarketFilter; label: string }[] = [
  { key: "all", label: "Всички" },
  { key: "bg",  label: "България" },
  { key: "ro",  label: "🇷🇴 Румъния" },
];

export function OrdersBoard({
  orders, histories, log, nowMs, initialMarket = "all",
}: {
  orders: AdminOrder[];
  histories: Record<string, CustomerHistory>;
  log: Record<number, StatusLogRow[]>;
  nowMs: number;
  initialMarket?: MarketFilter;
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [market, setMarket] = useState<MarketFilter>(initialMarket);
  const [showPending, setShowPending] = useState(false);   // the "Чакат плащане" chip view (unpaid card attempts)
  const [showDead, setShowDead] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethodFilter>("all");
  const [payState, setPayState] = useState<PayStateFilter>("all");
  const [notice, setNotice] = useState(""); // an action's warning (e.g. the Romanian e-mail did not go out) must outlive the card that raised it
  const [showFake, setShowFake] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [splitGroups, setSplitGroups] = useState<Set<string>>(new Set());

  // Live clock — ticks so the call-window banner + per-order timers update
  // without a manual refresh. Seeds from the server value (no hydration
  // mismatch), then switches to the client clock on mount.
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ageH = (o: AdminOrder) => (now - new Date(o.created_at).getTime()) / 3_600_000;

  // International "soft decline" waitlist orders never enter the normal queue —
  // they live in the separate "Международни" panel view. One filter here keeps them
  // out of every tab, counter and search at once (same pattern as excluded_from_stock).
  // Romanian orders are also stored with is_international (so no Bulgarian automation touches them) but they DO belong in this list.
  const notLead = (o: AdminOrder) => !o.is_international || isRoOrder(o);
  const inMarket = (o: AdminOrder) => market === "all" || marketOf(o) === market;
  const live = orders.filter((o) => !o.excluded_from_stock && notLead(o) && inMarket(o));
  // Unpaid card attempts (status pending_payment, or cancelled with payment_status expired/failed) are NOT orders: they stay out of
  // every fulfilment tab, counter and search, and are shown only under the "Чакат плащане" chip.
  const openAttempts = live.filter(isPendingPayment);
  const deadAttempts = live.filter((o) => isUnpaidCardAttempt(o) && !isPendingPayment(o));
  const salesOrders = live.filter((o) => !isUnpaidCardAttempt(o));
  // The payment filters combine with the tabs, the summary counters and the search.
  const real = salesOrders.filter((o) => matchesPayment(o, payMethod, payState));
  const fake = orders.filter((o) => o.excluded_from_stock && inMarket(o));
  const marketCount = (m: MarketFilter) => orders.filter((o) => !o.excluded_from_stock && notLead(o) && !isUnpaidCardAttempt(o) && (m === "all" || marketOf(o) === m)).length;
  const openTab = (t: Tab) => { setTab(t); setShowPending(false); };

  const count = (t: Tab) => real.filter((o) => inTab(o, t)).length;
  const stuckCount = real.filter((o) => o.status === "new" && ageH(o) > 24).length;

  // Orders due for a call in the currently-active window — drives the banner count.
  const dueNow = (o: AdminOrder) =>
    o.status === "new" &&
    callTimer(o.call_attempts ?? 0, o.last_attempt_at ? Date.parse(o.last_attempt_at) : null, now).status === "due";
  const dueCount = salesOrders.filter(dueNow).length;

  const tabOrders = real.filter((o) => inTab(o, tab));
  // "За обаждане" splits into first-call vs re-call (не вдига).
  const fresh  = tabOrders.filter((o) => (o.call_attempts ?? 0) === 0);
  const recall = tabOrders.filter((o) => (o.call_attempts ?? 0) > 0);

  // Search overrides the tab view — a flat, all-status result list.
  const searching = query.trim().length > 0;
  const matches = searching ? real.filter((o) => orderMatches(o, query)) : [];

  const card = (o: AdminOrder) => (
    <OrderCard key={o.id} order={o} history={o.phone ? histories[o.phone] : undefined} log={log[o.id]} now={now} onNotice={setNotice} />
  );

  // Render a same-customer cluster: single → normal card; 2+ identical address →
  // merged card; 2+ different addresses → auto-split with a note; manually split
  // → separate cards.
  const renderGroup = (g: AdminOrder[]) => {
    if (g.length === 1) return card(g[0]);
    const key = g.map((o) => o.id).sort((a, b) => a - b).join("-");
    const sorted = [...g].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const last = sorted[sorted.length - 1];

    if (!sameAddress(g)) {
      return (
        <div key={key} className="flex flex-col gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(250,199,117,0.08)", border: "0.5px solid rgba(250,199,117,0.3)", borderRadius: 10, padding: "9px 14px" }}>
            <span style={{ color: "#FAC775", fontSize: 13 }} aria-hidden>⚠</span>
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Един телефон, различни адреси — потвърди поотделно</span>
          </div>
          {sorted.map(card)}
        </div>
      );
    }
    if (splitGroups.has(key)) {
      return <div key={key} className="flex flex-col gap-4">{sorted.map(card)}</div>;
    }
    return (
      <GroupedOrderCard
        key={key}
        orders={g}
        history={last.phone ? histories[last.phone] : undefined}
        onNotice={setNotice}
        onSplit={() => setSplitGroups((s) => { const next = new Set(s); next.add(key); return next; })}
      />
    );
  };

  return (
    <>
      {/* Call-window timer — always visible; guidance only, no penalty */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <CallWindowBanner now={now} dueCount={dueCount} />
      </div>

      {notice && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3" style={{ position: "sticky", top: 56, zIndex: 20 }}>
          <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#3a2a08", border: "0.5px solid rgba(250,199,117,0.6)", borderRadius: 10, padding: "10px 14px" }}>
            <span style={{ color: "#FAC775", fontSize: 13 }} aria-hidden>⚠</span>
            <span style={{ flex: 1, color: "#FAC775", fontSize: 12, lineHeight: 1.5 }}>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Затвори" style={{ background: "none", border: "none", color: "rgba(250,199,117,0.7)", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Market filter — Всички / България / Румъния; every counter, tab and search below follows it */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex gap-2 flex-wrap items-center" role="group" aria-label="Пазар">
        {MARKETS.map((m) => {
          const active = market === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              aria-pressed={active}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: active ? "#fff" : "rgba(255,255,255,0.03)",
                border: `0.5px solid ${active ? "#fff" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? "#0a0e1f" : "rgba(255,255,255,0.6)",
              }}
            >
              {m.label}
              <span style={{ color: active ? "rgba(10,14,31,0.55)" : "rgba(255,255,255,0.35)", fontSize: 11 }}>{marketCount(m.key)}</span>
            </button>
          );
        })}
        {market === "ro" && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>суми в лей (≈ €), доставка с румънски куриер, имейлите към клиента са на румънски</span>}
      </div>

      {/* Summary — overview over everything; hidden while searching */}
      {!searching && (
        <div className="border-b border-white/6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex gap-2.5 items-stretch flex-wrap">
            <Chip onClick={() => openTab("new")}       count={stuckCount}    title="Над 24 часа"   sub="заседнали · обработи спешно" accent="#A32D2D"                  fg="#F09595" bg="rgba(163,45,45,0.16)" strong />
            <Chip onClick={() => openTab("new")}       count={count("new")}       title="Непотвърдени"  sub="за обаждане"                accent="rgba(255,255,255,0.12)" fg="#FAC775" />
            <Chip onClick={() => openTab("confirmed")} count={count("confirmed")} title="За изпълнение" sub="чакат пакетиране"           accent="rgba(255,255,255,0.12)" fg="#97C459" />
            <span className="ml-auto self-center text-white/25 text-[11px] hidden sm:block">клик = отвори подтаба</span>
          </div>
        </div>
      )}

      {/* Search box (always visible) + sub-tabs (hidden while searching) */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <SearchBox value={query} onChange={setQuery} count={matches.length} searching={searching} />

        <div className="mt-3">
          <PaymentFilters method={payMethod} state={payState} onMethod={setPayMethod} onState={setPayState} />
        </div>

        {!searching && (
          <div className="flex gap-2 flex-wrap items-center mt-3">
            <button
              onClick={() => setShowCreate(true)}
              className="order-last sm:order-none ml-auto sm:ml-0 sm:mr-2"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              + Създай поръчка
            </button>
            {TABS.map((t) => {
              const active = !showPending && tab === t.key;
              const c = count(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => openTab(t.key)}
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
            {/* Unpaid card attempts: not orders, read-only, shown only here */}
            {(openAttempts.length > 0 || deadAttempts.length > 0 || showPending) && (
              <button
                onClick={() => setShowPending(true)}
                aria-current={showPending ? "page" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: showPending ? "rgba(250,199,117,0.14)" : "transparent",
                  border: `${showPending ? "1px" : "0.5px"} dashed ${showPending ? "#FAC775" : "rgba(255,255,255,0.25)"}`,
                  borderRadius: 20, padding: "5px 12px", cursor: "pointer",
                  fontSize: 11, color: showPending ? "#FAC775" : "rgba(255,255,255,0.5)",
                }}
              >
                Чакат плащане · {openAttempts.length}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4">
        {searching ? (
          <>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              {matches.length} {matches.length === 1 ? "резултат" : "резултата"} за „{query.trim()}"
              {" · "}<span style={{ color: "rgba(255,255,255,0.35)" }}>всички статуси</span>
            </div>
            {matches.length === 0
              ? <Empty text="Няма поръчки за това търсене. Пробвай друго име, телефон, номер или продукт." />
              : matches.map(card)}
          </>
        ) : (
          <>
            {showPending ? (
              <>
                <SectionHeader label={`Чакат плащане · ${openAttempts.length}`} color="#FAC775" />
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>
                  Незавършени плащания с карта. Не са поръчки: не се звъни и не се изпраща. Наличността е резервирана и се връща автоматично, ако клиентът не плати.
                </p>
                {openAttempts.length === 0
                  ? <Empty text="Няма чакащи плащания." />
                  : openAttempts.map(card)}
                {deadAttempts.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-white/6">
                    <button
                      onClick={() => setShowDead((v) => !v)}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: 0 }}
                    >
                      {showDead ? "▾" : "▸"} {deadAttempts.length} изтекли / неуспешни плащания (не са поръчки)
                    </button>
                    {showDead && <div className="flex flex-col gap-4 mt-3">{deadAttempts.map(card)}</div>}
                  </div>
                )}
              </>
            ) : tab === "new" ? (
              <>
                <SectionHeader label={`Нови · за първо обаждане (${fresh.length})`} />
                {fresh.length === 0
                  ? <Empty text="Няма нови поръчки за първо обаждане." />
                  : groupByCustomer(fresh).map(renderGroup)}

                {recall.length > 0 && (
                  <>
                    <SectionHeader label={`✆ Чакат повторно обаждане · не вдига (${recall.length})`} color="#FAC775" />
                    {groupByCustomer(recall).map(renderGroup)}
                  </>
                )}
              </>
            ) : tab === "confirmed" ? (
              <>
                {market !== "ro" && <MatchPanel />}
                {tabOrders.length === 0
                  ? <Empty text="Няма поръчки за изпълнение." />
                  : tabOrders.map(card)}
              </>
            ) : tab === "shipped" ? (
              <>
                {market !== "ro" && <EcontCheck />}
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
            {!showPending && fake.length > 0 && (
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
          </>
        )}
      </main>

      {showCreate && <CreateOrderForm onClose={() => setShowCreate(false)} />}
    </>
  );
}

function SearchBox({
  value, onChange, count, searching,
}: {
  value: string; onChange: (v: string) => void; count: number; searching: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.05)",
        border: `0.5px solid ${searching ? "rgba(133,183,235,0.4)" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 10, padding: "9px 14px",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, lineHeight: 1 }} aria-hidden>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Търси по име, телефон, номер или продукт…"
        aria-label="Търси в поръчките"
        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14 }}
      />
      {searching && (
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, whiteSpace: "nowrap" }}>{count}</span>
      )}
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Изчисти търсенето"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function CallWindowBanner({ now, dueCount }: { now: number; dueCount: number }) {
  const active = activeWindow(now);
  const next = nextWindow(now);
  if (active) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(151,196,89,0.14)", border: "1px solid #97C459", borderRadius: 12, padding: "12px 16px", flexWrap: "wrap" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#97C459", display: "inline-block", flexShrink: 0 }} />
        <span style={{ color: "#C0DD97", fontSize: 14, fontWeight: 500 }}>Сега е време за обаждане · {active.label}</span>
        <span style={{ color: "rgba(192,221,151,0.75)", fontSize: 12 }}>{dueCount} {dueCount === 1 ? "чака" : "чакат"} сега</span>
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>следващ прозорец: {next.when} {next.label}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", flexWrap: "wrap" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "inline-block", flexShrink: 0 }} />
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>Извън прозорец за обаждане</span>
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>следващо обаждане: <span style={{ color: "#FAC775" }}>{next.when} {next.label}</span></span>
    </div>
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
        {msg || "Доставените от Еконт автоматично стават завършени."}
      </span>
    </div>
  );
}

function ReturnsSummary({ orders, dispatched }: { orders: AdminOrder[]; dispatched: number }) {
  const total = orders.length;
  const uncollected  = orders.filter((o) => o.return_kind === "uncollected").length;
  const refused      = orders.filter((o) => o.return_kind === "refused").length;
  const unclassified = total - uncollected - refused;
  // returning (or the legacy value) = not yet physically in hand · restocked = received, stock +1.
  const awaiting  = orders.filter((o) => o.status === "returning" || o.status === "returned").length;
  const restocked = orders.filter((o) => o.status === "restocked").length;
  const rate            = dispatched > 0 ? Math.round((total / dispatched) * 100) : 0;
  const uncollectedRate = dispatched > 0 ? Math.round((uncollected / dispatched) * 100) : 0;
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", background: "rgba(240,153,123,0.08)", border: "0.5px solid rgba(240,153,123,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13 }}>
      <span style={{ color: "rgba(255,255,255,0.75)" }}>Върнати: <b style={{ color: "#F0997B" }}>{total}</b></span>
      <span style={{ color: "#F0997B" }}>↩ Непотърсени: <b>{uncollected}</b>{dispatched > 0 && <span style={{ color: "rgba(255,255,255,0.4)" }}> (~{uncollectedRate}% · твоя загуба)</span>}</span>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>Върнати след преглед: <b>{refused}</b></span>
      {unclassified > 0 && <span style={{ color: "rgba(255,255,255,0.4)" }}>некласифицирани: {unclassified}</span>}
      {awaiting > 0 && <span style={{ color: "#FAC775" }}>⏳ чакат взимане: <b>{awaiting}</b></span>}
      {restocked > 0 && <span style={{ color: "#97C459" }}>✓ в наличност: <b>{restocked}</b></span>}
      <span style={{ color: "rgba(255,255,255,0.5)" }}>общо връщания ~{rate}% <span style={{ color: "rgba(255,255,255,0.3)" }}>от изпратените</span></span>
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
