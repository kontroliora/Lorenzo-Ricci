import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { getOrders, getCustomerHistories, getStatusLog } from "@/lib/orders";
import { getAbandonedCarts } from "@/lib/abandoned-carts-server";
import type { AbandonedCart } from "@/lib/abandoned-carts";
import { modeOfKey } from "@/lib/stripe-mode";
import { getStuckSummary } from "@/lib/checkout-events-server";
import type { StuckSummary } from "@/lib/checkout-events";
import { OrdersBoard } from "./OrdersBoard";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reconcileBeforePanel } from "@/lib/stripe-reconcile";
import { getAdminSession } from "@/lib/supabase/admin-db";
import { fulfillmentVisible } from "@/lib/fulfillment-filter";
import { labelMode } from "@/lib/econt-shipping";
import { getRiskMap } from "@/lib/customer-risk";
import { nekorektenConfigured } from "@/lib/nekorekten";
import { adminDb } from "@/lib/supabase/admin-db";
import type { CustomerRisk } from "@/lib/customer-risk-shared";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const initialMarket = m === "ro" ? "ro" : m === "bg" ? "bg" : "all";
  // Was 150 — with >150 orders the oldest (stuck new/confirmed) fell off the
  // panel entirely. Raised so every order shows; paginate properly when it grows.
  // A card payment Stripe has but the board does not (missed webhook) is written first, so nobody ships a paid order as COD.
  const session = await getAdminSession().catch(() => null);
  const role = session?.role ?? "employee";
  if ((process.env.STRIPE_SECRET_KEY ?? "").trim()) await reconcileBeforePanel(supabaseAdmin());
  const ordersRaw = await getOrders(1000);
  // Fulfillment role: hide orders that contain ONLY women's-collection jewelry.
  // Same classification as the partner view — lib/fulfillment-filter.ts uses isCollectionLine from lib/partner/orders.ts.
  const orders = role === "fulfillment" ? ordersRaw.filter(fulfillmentVisible) : ordersRaw;
  const histories = await getCustomerHistories(orders.map((o) => o.phone ?? "").filter(Boolean));
  // Некоректни клиенти: ONE database call for every phone on the page (lib/customer-risk.ts); never takes the page down.
  let risk: Record<string, CustomerRisk> = {};
  try { risk = await getRiskMap(await adminDb(), orders.map((o) => o.phone)); } catch (e) { console.error("[orders] risk unavailable:", e instanceof Error ? e.message : e); }
  if (role === "fulfillment") {
    // Коко: the counts stay (the risk is the customer's), but links only to orders he may open
    const visible = new Set(orders.map((o) => o.id));
    for (const r of Object.values(risk)) r.incidents = r.incidents.filter((i) => visible.has(i.id));
  }
  const log = await getStatusLog(orders.map((o) => o.id), Object.fromEntries(orders.map((o) => [o.id, o.order_ref])));
  const nowMs = Date.now();
  // Only the MODE of the site's Stripe key goes to the browser (never the key): the cancel dialog says whether a card order will be refunded.
  const rawKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeKey: "live" | "test" | "none" = !rawKey ? "none" : modeOfKey(rawKey) === "live" ? "live" : "test";
  // "Изоставени колички": a problem reading them must never take the orders page down.
  let carts: AbandonedCart[] = [];
  let stuck: StuckSummary | null = null;
  if (role !== "fulfillment") {
    try { carts = await getAbandonedCarts(nowMs); } catch (e) { console.error("[orders] abandoned carts unavailable:", e instanceof Error ? e.message : e); }
    try { stuck = await getStuckSummary(nowMs); } catch { /* the summary is optional */ }
  }

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
      <AdminNav role={session?.role} />

      {/* Summary counters + filterable list */}
      <OrdersBoard orders={orders} histories={histories} log={log} nowMs={nowMs} initialMarket={initialMarket} carts={carts} stuck={stuck} stripeKey={stripeKey} role={role} labelsMode={labelMode()} risk={risk} extConfigured={nekorektenConfigured()} />
    </div>
  );
}
