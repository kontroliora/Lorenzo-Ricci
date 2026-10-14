"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRoCart } from "@/lib/ro/store";
import { RO_DELIVERY_DAYS, fmtRON } from "@/lib/ro/config";
import { trackFbEvent } from "@/lib/fbq";
import { PENDING_ORDER_KEY } from "@/lib/payments";

// Stripe success return for the Romania shop (lib/payments.ts, contract item 3). The customer lands here after paying;
// the webhook is what really confirms the payment, so this page asks GET /api/order-payment every 2 s (max 60 s) and only
// on "paid" clears the cart and fires the browser Purchase (event id = order reference, matching the server CAPI event).

const POLL_MS = 2000;
const POLL_MAX_MS = 60_000;
const REF_RE = /^[A-Za-z0-9_-]{4,40}$/;

type PaidItem = { sku: string; quantity: number };
type Phase =
  | { kind: "checking" }
  | { kind: "paid"; total: number | null }
  | { kind: "pending" }
  | { kind: "failed" };
type StatusBody = { status?: string; total?: number; currency?: string; items?: unknown };

// Purchase must fire once per order: sessionStorage survives a reload of this tab, the Set covers blocked storage.
const firedThisLoad = new Set<string>();
function firePurchaseOnce(ref: string, total: number, items: PaidItem[]) {
  if (firedThisLoad.has(ref)) return;
  firedThisLoad.add(ref);
  const key = `lr_purchase_fired_${ref}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch { /* storage blocked: the Set above still prevents a second event on this page load */ }
  trackFbEvent("Purchase", {
    value: total,
    currency: "RON",
    content_ids: items.map((i) => i.sku),
    contents: items.map((i) => ({ id: i.sku, quantity: i.quantity })),
    content_type: "product",
    content_category: "RO",
    order_id: ref,
  }, ref);
}

function parseItems(raw: unknown): PaidItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PaidItem[] = [];
  for (const r of raw) {
    const sku = (r as { sku?: unknown } | null)?.sku;
    const quantity = (r as { quantity?: unknown } | null)?.quantity;
    if (typeof sku === "string" && sku && typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0) out.push({ sku, quantity });
  }
  return out;
}

function Finalizata() {
  const params = useSearchParams();
  const refParam = params.get("ref") ?? "";
  const sessionId = params.get("session_id") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [orderRef, setOrderRef] = useState("");

  useEffect(() => {
    // The reference comes from the URL; the one parked in sessionStorage by the checkout is the fallback.
    let ref = REF_RE.test(refParam) ? refParam : "";
    if (!ref) {
      try { ref = sessionStorage.getItem(PENDING_ORDER_KEY) ?? ""; } catch { /* storage blocked */ }
      if (!REF_RE.test(ref)) { setPhase({ kind: "failed" }); return; }
    }
    setOrderRef(ref);

    const query = new URLSearchParams({ ref });
    if (sessionId) query.set("session_id", sessionId);
    const url = `/api/order-payment?${query.toString()}`;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    const tick = async () => {
      let data: StatusBody | null = null;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) data = (await res.json()) as StatusBody;
      } catch { /* a network or server hiccup is retried until the 60 s are up */ }
      if (cancelled) return;

      if (data?.status === "paid") {
        const total = typeof data.total === "number" && Number.isFinite(data.total) ? data.total : null;
        const items = parseItems(data.items);
        setPhase({ kind: "paid", total });
        useRoCart.getState().clear();
        try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* storage blocked */ }
        if (total !== null) firePurchaseOnce(ref, total, items);
        return;
      }
      if (data?.status === "expired" || data?.status === "unknown") {
        setPhase({ kind: "failed" });
        return;
      }
      if (Date.now() - started >= POLL_MAX_MS) {
        setPhase({ kind: "pending" });
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [refParam, sessionId]);

  if (phase.kind === "checking") return <Waiting />;

  if (phase.kind === "paid") {
    return (
      <Shell
        tag="Comanda dumneavoastră"
        title="Plata a fost efectuată cu succes"
        icon={
          <div className="w-14 h-14 rounded-full bg-navy flex items-center justify-center mx-auto mb-6">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        }
        sub={`Număr comandă: ${orderRef}`}
      >
        <div className="bg-white border border-border p-6 flex flex-col gap-3">
          {phase.total !== null && (
            <div className="flex justify-between gap-4 text-sm">
              <span className="font-sans text-ink-muted">Sumă plătită</span>
              <span className="font-serif text-charcoal">{fmtRON(phase.total)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-sans text-ink-muted">Metodă de plată</span>
            <span className="font-sans text-charcoal">Plătit cu cardul</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-sans text-ink-muted">Livrare estimată</span>
            <span className="font-sans text-charcoal text-right">{RO_DELIVERY_DAYS} zile lucrătoare de la expediere</span>
          </div>
        </div>

        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide text-center mt-8">
          Am trimis confirmarea pe adresa dumneavoastră de e-mail.
        </p>
        <p className="font-sans text-sm text-charcoal text-center mt-2">Nu aveți nimic de plătit la livrare.</p>

        <div className="flex justify-center mt-10">
          <Link href="/ro" className="btn-primary min-w-[220px]">Continuați cumpărăturile</Link>
        </div>
      </Shell>
    );
  }

  if (phase.kind === "pending") {
    return (
      <Shell
        tag="Plata comenzii"
        title="Confirmare în curs"
        icon={<StatusIcon>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </StatusIcon>}
        sub={orderRef ? `Număr comandă: ${orderRef}` : undefined}
      >
        <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide text-center">
          Plata dumneavoastră este în curs de confirmare. Veți primi un e-mail când comanda este confirmată.
        </p>
        <div className="flex justify-center mt-10">
          <Link href="/ro" className="btn-primary min-w-[220px]">Înapoi la magazin</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      tag="Plata comenzii"
      title="Plată nefinalizată"
      icon={<StatusIcon>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="7.5" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12" y2="16.6" />
      </StatusIcon>}
    >
      <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide text-center">
        Plata nu a fost finalizată. Comanda nu a fost confirmată - puteți încerca din nou.
      </p>
      <div className="flex justify-center mt-10">
        <Link href="/ro" className="btn-primary min-w-[220px]">Înapoi la magazin</Link>
      </div>
    </Shell>
  );
}

function Waiting() {
  return (
    <Shell
      tag="Plata comenzii"
      title="Confirmăm plata dumneavoastră..."
      icon={
        <div className="flex justify-center mb-6" role="status" aria-live="polite">
          <span className="w-9 h-9 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
        </div>
      }
    >
      <p className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide text-center">
        Vă rugăm să nu închideți această pagină.
      </p>
    </Shell>
  );
}

function StatusIcon({ children }: { children: ReactNode }) {
  return (
    <div className="w-14 h-14 rounded-full border border-navy/30 flex items-center justify-center mx-auto mb-6">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F2850" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

function Shell({ tag, title, icon, sub, children }: { tag: string; title: string; icon: ReactNode; sub?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      <div className="py-16 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        {icon}
        <p className="section-tag mb-4">{tag}</p>
        <h1 className="font-serif text-display-md text-charcoal mb-4">{title}</h1>
        <div className="gold-divider" />
        {sub && <p className="font-sans text-[11px] tracking-[0.22em] uppercase text-ink-muted mt-6 break-all">{sub}</p>}
      </div>
      <div className="max-w-xl mx-auto px-5 sm:px-8 mt-10">{children}</div>
    </div>
  );
}

export default function FinalizataPage() {
  return (
    <Suspense fallback={<Waiting />}>
      <Finalizata />
    </Suspense>
  );
}
