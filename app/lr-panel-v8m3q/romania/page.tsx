import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { getOrders } from "@/lib/orders";
import { RomaniaBoard } from "./RomaniaBoard";

export const dynamic = "force-dynamic";

// Romanian market test: orders placed on /ro (amounts in lei, cash on delivery, Romanian courier). They are stored with
// is_international = true / ship_country = 'RO', so the Bulgarian board and every Econt cron skip them.
export default async function RomaniaPage() {
  const all = await getOrders(1000);
  const orders = all.filter((o) => o.ship_country === "RO");

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Румъния</p>
          </div>
          <form action={logout}>
            <button type="submit" className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors">Изход ↗</button>
          </form>
        </div>
      </header>
      <AdminNav />
      <RomaniaBoard orders={orders} />
    </div>
  );
}
