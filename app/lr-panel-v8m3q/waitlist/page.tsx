import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { logout } from "../actions";
import { isOwner } from "@/lib/admin-auth";
import { getOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

// International "soft decline" leads (Dubai test). Read-only contact list for
// manual follow-up — deliberately separate from the normal orders board, which
// excludes is_international. Owner-only, like Оборот / ROAS.
export default async function WaitlistPage() {
  if (!(await isOwner())) redirect("/lr-panel-v8m3q/orders");

  const all = await getOrders(1000);
  const leads = all.filter((o) => o.is_international);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const itemNames = (items: { name?: string; quantity?: number; qty?: number }[]) =>
    (items ?? []).map((i) => `${i.name ?? "—"}${(i.quantity ?? i.qty ?? 1) > 1 ? ` ×${i.quantity ?? i.qty}` : ""}`).join(", ");

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="font-sans text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Международни</p>
          </div>
          <form action={logout}>
            <button type="submit" className="font-sans text-xs text-white/35 hover:text-white tracking-widest uppercase transition-colors">Изход ↗</button>
          </form>
        </div>
      </header>

      <AdminNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-sans text-sm tracking-[0.14em] uppercase text-white/80">Международни заявки · {leads.length}</h1>
          <p className="font-sans text-xs text-white/40 mt-1">
            „Soft decline" от чуждестранни IP-та. Контакти за следване — извън нормалната Econt опашка. Изпратен е 5% код с извинение.
          </p>
        </div>

        {leads.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-20">Още няма международни заявки.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left" style={{ fontSize: 13 }}>
              <thead>
                <tr className="text-white/40 border-b border-white/10" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Име</th>
                  <th className="px-4 py-3 font-medium">Контакт</th>
                  <th className="px-4 py-3 font-medium">Държава</th>
                  <th className="px-4 py-3 font-medium">Продукт</th>
                  <th className="px-4 py-3 font-medium text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((o) => (
                  <tr key={o.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-white">
                      {o.name || "—"}
                      {o.order_ref && <span className="text-white/30 ml-2" style={{ fontFamily: "monospace", fontSize: 11 }}>{o.order_ref}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {o.email && <a href={`mailto:${o.email}`} className="text-[#85B7EB] block">{o.email}</a>}
                      {o.phone && <a href={`tel:${o.phone}`} className="text-white/50 block">{o.phone}</a>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{o.ship_country || "—"}{o.city ? `, ${o.city}` : ""}</td>
                    <td className="px-4 py-3 text-white/70">{itemNames(o.items)}</td>
                    <td className="px-4 py-3 text-right text-white whitespace-nowrap">€{Number(o.total ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
