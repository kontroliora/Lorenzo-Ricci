import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { getOrders, getCustomerHistories, getStatusLog } from "@/lib/orders";
import { OrdersBoard } from "./OrdersBoard";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders(150);
  const histories = await getCustomerHistories(orders.map((o) => o.phone ?? "").filter(Boolean));
  const log = await getStatusLog(orders.map((o) => o.id));
  const nowMs = Date.now();

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
      <OrdersBoard orders={orders} histories={histories} log={log} nowMs={nowMs} />
    </div>
  );
}
