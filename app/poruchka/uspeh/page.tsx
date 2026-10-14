"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { trackFbEvent } from "@/lib/fbq";
import { PENDING_ORDER_KEY } from "@/lib/payments";
import { clearCardCartSnapshot } from "@/lib/card-cart-snapshot";

// Stripe's success_url. Coming back here does NOT prove the payment: the order is confirmed by the Stripe webhook, so
// this page polls GET /api/order-payment (every 2 s, up to 60 s) until the server says "paid".

const POLL_MS = 2000;
const MAX_WAIT_MS = 60_000;

type Paid = { total: number | null; currency: string; items: { sku: string; quantity: number }[] };
type View = { kind: "checking" } | { kind: "paid"; paid: Paid } | { kind: "pending" } | { kind: "failed" };

const money = (amount: number, currency: string) =>
  currency === "RON" ? `${amount.toFixed(2)} lei` : `€${amount.toFixed(2)}`;

function PaymentReturn() {
  const params    = useSearchParams();
  const ref       = (params.get("ref") ?? "").trim();
  const sessionId = (params.get("session_id") ?? "").trim();
  const [view, setView] = useState<View>(ref ? { kind: "checking" } : { kind: "failed" });
  const purchaseFired = useRef(false);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    // Cart emptied, pending marker gone, Purchase sent exactly once (the browser event id is the order reference, so it
    // deduplicates with the server-side CAPI Purchase the webhook sends).
    const onPaid = (paid: Paid) => {
      useCartStore.getState().clearCart();
      clearCardCartSnapshot();
      try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* ignore */ }

      const guardKey = `lr_purchase_fired_${ref}`;
      let alreadyFired = purchaseFired.current;
      try { alreadyFired = alreadyFired || localStorage.getItem(guardKey) === "1" || sessionStorage.getItem(guardKey) === "1"; } catch { /* ignore */ }
      if (!alreadyFired) {
        purchaseFired.current = true;
        try { localStorage.setItem(guardKey, "1"); sessionStorage.setItem(guardKey, "1"); } catch { /* ignore */ }
        trackFbEvent("Purchase", {
          value:        paid.total ?? 0,
          currency:     "EUR",
          content_ids:  paid.items.map((i) => i.sku),
          contents:     paid.items.map((i) => ({ id: i.sku, quantity: i.quantity })),
          content_type: "product",
          order_id:     ref,
        }, ref);
      }
      setView({ kind: "paid", paid });
    };

    const tick = async () => {
      let status = "pending"; // a failed request is not a verdict on the payment: keep waiting
      let data: Record<string, unknown> | null = null;
      try {
        const qs  = `ref=${encodeURIComponent(ref)}&session_id=${encodeURIComponent(sessionId)}`;
        const res = await fetch(`/api/order-payment?${qs}`, { cache: "no-store" });
        if (res.ok) {
          data = (await res.json()) as Record<string, unknown>;
          if (typeof data?.status === "string") status = data.status;
        }
      } catch { /* network hiccup - try again */ }
      if (cancelled) return;

      if (status === "paid" && data) {
        const items = Array.isArray(data.items)
          ? (data.items as Array<{ sku?: unknown; quantity?: unknown }>)
              .filter((i) => typeof i?.sku === "string")
              .map((i) => ({ sku: String(i.sku), quantity: Math.max(1, Number(i.quantity) || 1) }))
          : [];
        onPaid({
          total:    typeof data.total === "number" ? data.total : null,
          currency: typeof data.currency === "string" ? data.currency : "EUR",
          items,
        });
      } else if (status === "expired" || status === "unknown") {
        setView({ kind: "failed" });
      } else if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setView({ kind: "pending" });
      } else {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [ref, sessionId]);

  return (
    <div className="min-h-screen pt-[116px] pb-24 px-5 sm:px-8">
      <div className="max-w-xl mx-auto mt-10 sm:mt-16 bg-ivory-card border border-border px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_2px_24px_rgba(15,12,8,0.06)]">
        {view.kind === "checking" && <Checking />}
        {view.kind === "paid" && <PaidView orderRef={ref} paid={view.paid} />}
        {view.kind === "pending" && <PendingView />}
        {view.kind === "failed" && <FailedView />}
      </div>
    </div>
  );
}

function Checking() {
  return (
    <div role="status" aria-live="polite">
      <div className="w-9 h-9 mx-auto mb-6 border-2 border-navy/15 border-t-navy rounded-full animate-spin" />
      <h1 className="font-serif text-display-sm text-charcoal">Потвърждаваме плащането ви...</h1>
      <p className="font-sans text-sm text-ink-muted leading-relaxed mt-3">
        Отнема само няколко секунди. Моля, не затваряйте страницата.
      </p>
    </div>
  );
}

function PaidView({ orderRef, paid }: { orderRef: string; paid: Paid }) {
  return (
    <>
      <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <p className="section-tag mb-3">Платено с карта</p>
      <h1 className="font-serif text-display-sm text-charcoal">Плащането е успешно</h1>
      <div className="gold-divider" />

      <div className="border border-border bg-ivory-warm px-5 py-4 flex flex-col gap-2.5 text-left">
        <div className="flex justify-between gap-4 text-sm">
          <span className="font-sans text-ink-muted">Номер на поръчка</span>
          <span className="font-sans text-charcoal tracking-wide">{orderRef}</span>
        </div>
        {paid.total !== null && (
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-sans text-ink-muted">Платена сума</span>
            <span className="font-serif text-charcoal text-base">{money(paid.total, paid.currency)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 text-sm">
          <span className="font-sans text-ink-muted">Начин на плащане</span>
          <span className="font-sans text-charcoal">Платено с карта</span>
        </div>
      </div>

      <p className="font-sans text-sm text-ink-soft leading-relaxed mt-6">
        Изпратихме потвърждение на вашия имейл.
      </p>
      <p className="font-sans text-sm text-ink-soft leading-relaxed mt-2">
        Доставка до 2 работни дни. Не се плаща нищо при доставка.
      </p>

      <Link href="/" className="btn-primary w-full mt-8">Продължи пазаруването</Link>
    </>
  );
}

function PendingView() {
  return (
    <>
      <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-ivory-paper border border-border flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F2850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <p className="section-tag mb-3">Плащане с карта</p>
      <h1 className="font-serif text-display-sm text-charcoal">Плащането ви се потвърждава</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm text-ink-soft leading-relaxed">
        Ще получите имейл, когато поръчката бъде потвърдена.
      </p>
      <Link href="/" className="btn-primary w-full mt-8">Продължи пазаруването</Link>
    </>
  );
}

function FailedView() {
  return (
    <>
      <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-ivory-paper border border-border flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F2850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
      <p className="section-tag mb-3">Плащане с карта</p>
      <h1 className="font-serif text-display-sm text-charcoal">Плащането не е завършено</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm text-ink-soft leading-relaxed">
        Поръчката не е потвърдена - можете да опитате отново.
      </p>
      <Link href="/" className="btn-primary w-full mt-8">Към магазина</Link>
    </>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-[116px] pb-24 px-5 sm:px-8">
          <div className="max-w-xl mx-auto mt-10 sm:mt-16 bg-ivory-card border border-border px-6 py-10 sm:px-12 sm:py-14 text-center shadow-[0_2px_24px_rgba(15,12,8,0.06)]">
            <Checking />
          </div>
        </div>
      }
    >
      <PaymentReturn />
    </Suspense>
  );
}
