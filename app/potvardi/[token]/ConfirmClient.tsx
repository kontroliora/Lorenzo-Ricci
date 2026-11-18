"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { OrderSummary } from "@/lib/confirm-by-email";

// Nothing happens on load: the order is confirmed ONLY when the customer presses the button (a POST with the token). Without
// JavaScript the same button submits a plain form (POST) and the server sends the page back showing the result.
type View = "ask" | "working" | "confirmed" | "already" | "closed" | "error";

const GOLD = "#C9A961";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-[116px] pb-24 px-5 sm:px-8">
      <div className="max-w-xl mx-auto mt-10 sm:mt-16 bg-ivory-card border border-border px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_2px_24px_rgba(15,12,8,0.06)]">
        {children}
      </div>
    </div>
  );
}

const Check = () => (
  <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
);

const Help = () => (
  <p className="font-sans text-xs text-ink-muted leading-relaxed mt-4">
    Нещо не е наред? Отговорете на имейла или ни пишете на{" "}
    <a href="mailto:info@lorenzo-ricci.com" className="underline">info@lorenzo-ricci.com</a>
  </p>
);

export function ConfirmClient({ token, ref_, initial, summary }: { token: string; ref_: string; initial: "open" | "already"; summary?: OrderSummary }) {
  const [view, setView] = useState<View>(initial === "already" ? "already" : "ask");
  const [ref, setRef] = useState(ref_);

  // One POST per page, however often the button is tapped (a double tap sent two: the second answered "already" and hid the thanks).
  const busy = useRef(false);
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setView("working");
    try {
      const res = await fetch("/api/order-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
      const out = (await res.json()) as { kind?: string; ref?: string };
      if (out.ref) setRef(out.ref);
      setView(out.kind === "confirmed" ? "confirmed" : out.kind === "already" ? "already" : out.kind === "closed" ? "closed" : "error");
    } catch { setView("error"); }
  };

  if (view === "ask" || view === "working") return (
    <Shell>
      <p className="section-tag mb-3">Поръчка №{ref}</p>
      <h1 className="font-serif text-display-sm text-charcoal">Потвърдете поръчката си</h1>
      <div className="gold-divider" />
      {summary && (
        <div data-testid="confirm-summary" className="border border-border bg-ivory-warm px-5 py-4 flex flex-col gap-2.5 text-left">
          {summary.items.map((i, n) => (
            <div key={n} className="flex justify-between gap-4 text-sm">
              <span className="font-sans text-charcoal">{i.name}{i.color ? <span className="text-ink-muted"> · {i.color}</span> : null}</span>
              <span className="font-sans text-ink-muted whitespace-nowrap">×{i.qty}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2.5 flex justify-between gap-4 text-sm">
            <span className="font-sans text-ink-muted">Обща сума</span>
            <span className="font-sans text-charcoal"><span className="font-serif text-base">{summary.total}</span> ({summary.payment})</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-sans text-ink-muted whitespace-nowrap">Доставка до</span>
            <span className="font-sans text-charcoal text-right">{summary.delivery}</span>
          </div>
        </div>
      )}
      <form method="post" action="/api/order-confirm" onSubmit={confirm} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          data-testid="confirm-button"
          disabled={view === "working"}
          className="w-full font-sans font-bold uppercase whitespace-nowrap disabled:opacity-70"
          style={{ background: GOLD, color: "#111111", border: `1px solid ${GOLD}`, borderRadius: 2, padding: "16px 12px", fontSize: 12, letterSpacing: ".18em" }}
        >
          {view === "working" ? "Потвърждаваме…" : "Потвърждавам поръчката"}
        </button>
      </form>
      <Help />
    </Shell>
  );

  if (view === "confirmed" || view === "already") return (
    <Shell>
      <Check />
      <p className="section-tag mb-3">Поръчка №{ref}</p>
      <h1 className="font-serif text-display-sm text-charcoal">{view === "confirmed" ? "Благодарим Ви!" : "Поръчката вече е потвърдена"}</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm text-ink-soft leading-relaxed">
        {view === "confirmed" ? `Поръчката №${ref} е потвърдена. ` : `Поръчката №${ref} вече е потвърдена – не е нужно да правите нищо повече. `}
        Ще я изпратим до 1–2 работни дни с Еконт и ще получите имейл с номер на пратката. Няма да Ви търсим повече по телефона.
      </p>
      <Link href="/" className="btn-primary w-full mt-8">Към магазина</Link>
    </Shell>
  );

  return (
    <Shell>
      <p className="section-tag mb-3">Поръчка №{ref}</p>
      <h1 className="font-serif text-display-sm text-charcoal">{view === "closed" ? "Поръчката не е активна" : "Временна грешка"}</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm text-ink-soft leading-relaxed">
        {view === "closed"
          ? "Тази поръчка вече не е активна. Ако желаете да я възстановите, отговорете на имейла или ни пишете на info@lorenzo-ricci.com."
          : "Не успяхме да потвърдим поръчката. Опитайте отново след малко или отговорете на имейла, който получихте."}
      </p>
      <Link href="/" className="btn-primary w-full mt-8">Към магазина</Link>
    </Shell>
  );
}
