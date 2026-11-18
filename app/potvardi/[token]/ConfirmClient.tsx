"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type View = "working" | "confirmed" | "already" | "closed" | "error";

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

/** Posts the token once on load (a mail scanner's GET never confirms); without JavaScript the form button does the same. */
export function ConfirmClient({ token, ref_, initial }: { token: string; ref_: string; initial: "open" | "test" | "already" }) {
  const [view, setView] = useState<View>(initial === "already" ? "already" : "working");
  const [ref, setRef] = useState(ref_);
  const sent = useRef(false);

  useEffect(() => {
    if (initial === "already" || sent.current) return;
    sent.current = true;
    (async () => {
      try {
        const res = await fetch("/api/order-confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
        const out = (await res.json()) as { kind?: string; ref?: string };
        if (out.ref) setRef(out.ref);
        setView(out.kind === "confirmed" ? "confirmed" : out.kind === "already" ? "already" : out.kind === "closed" ? "closed" : "error");
      } catch { setView("error"); }
    })();
  }, [initial, token]);

  if (view === "working") return (
    <Shell>
      <div role="status" aria-live="polite">
        <div className="w-9 h-9 mx-auto mb-6 border-2 border-navy/15 border-t-navy rounded-full animate-spin" />
        <h1 className="font-serif text-display-sm text-charcoal">Потвърждаваме поръчката Ви…</h1>
        <noscript>
          <form method="post" action="/api/order-confirm" className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn-primary w-full">Потвърждавам поръчката</button>
          </form>
        </noscript>
      </div>
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
