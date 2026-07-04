import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { getOrders, getCustomerHistories, getStatusLog } from "@/lib/orders";
import { OrderCard } from "./OrderCard";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders(150);
  const histories = await getCustomerHistories(orders.map((o) => o.phone ?? "").filter(Boolean));
  const log = await getStatusLog(orders.map((o) => o.id));

  const newCount     = orders.filter((o) => o.status === "new").length;
  const activeCount  = orders.filter((o) => o.status === "confirmed" || o.status === "shipped").length;

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

      {/* Stats strip */}
      <div className="border-b border-white/6 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">За обаждане</p>
            <p className={`font-sans text-lg mt-0.5 ${newCount > 0 ? "text-amber-400" : "text-white/30"}`}>{newCount}</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div>
            <p className="font-sans text-[10px] text-white/30 tracking-wide uppercase">В обработка</p>
            <p className="font-sans text-lg text-white mt-0.5">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Orders list */}
      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-4">
        {orders.length === 0 && (
          <p className="text-white/40 text-sm text-center py-16">Няма поръчки за показване.</p>
        )}
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} history={o.phone ? histories[o.phone] : undefined} log={log[o.id]} />
        ))}
      </main>
    </div>
  );
}
