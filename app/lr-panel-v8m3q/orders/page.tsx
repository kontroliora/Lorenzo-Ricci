import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { getOrders, getCustomerHistories, getStatusLog } from "@/lib/orders";
import { getAbandonedCarts } from "@/lib/abandoned-carts-server";
import type { AbandonedCart } from "@/lib/abandoned-carts";
import { modeOfKey } from "@/lib/stripe-mode";
import { getStuckSummary } from "@/lib/checkout-events-server";
import type { StuckSummary } from "@/lib/checkout-events";
import { OrdersBoard } from "./OrdersBoard";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const initialMarket = m === "ro" ? "ro" : m === "bg" ? "bg" : "all";
  // Was 150 — with >150 orders the oldest (stuck new/confirmed) fell off the
  // panel entirely. Raised so every order shows; paginate properly when it grows.
  const orders = await getOrders(1000);
  const histories = await getCustomerHistories(orders.map((o) => o.phone ?? "").filter(Boolean));
  const log = await getStatusLog(orders.map((o) => o.id));
  const nowMs = Date.now();
  // Only the MODE of the site's Stripe key goes to the browser (never the key): the cancel dialog says whether a card order will be refunded.
  const rawKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeKey: "live" | "test" | "none" = !rawKey ? "none" : modeOfKey(rawKey) === "live" ? "live" : "test";
  // "Изоставени колички": a problem reading them must never take the orders page down.
  let carts: AbandonedCart[] = [];
  try { carts = await getAbandonedCarts(nowMs); } catch (e) { console.error("[orders] abandoned carts unavailable:", e instanceof Error ? e.message : e); }
  let stuck: StuckSummary | null = null;
  try { stuck = await getStuckSummary(nowMs); } catch { /* the summary is optional */ }

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Поръчки</p>
          </div>
          <form action={logout}>
            <button type="submit" className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors">Изход ↗</button>
          </form>
        </div>
      </header>

      {/* Admin navigation */}
      <AdminNav />

      {/* Summary counters + filterable list */}
      <OrdersBoard orders={orders} histories={histories} log={log} nowMs={nowMs} initialMarket={initialMarket} carts={carts} stuck={stuck} stripeKey={stripeKey} />
    </div>
  );
}
