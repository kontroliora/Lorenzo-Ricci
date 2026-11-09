import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { isOwner } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PARTNER_STATUS_LABEL, isPartnerStatus } from "@/lib/partner/orders";
import { logout } from "../actions";
import { AddPartnerForm, MissedOrders, PartnerToggle } from "./PartnerControls";
import { PARTNER_PAUSED } from "@/lib/partner/email";

export const dynamic = "force-dynamic";

// Owner-only: the partner (women's jewellery) - the on/off toggle (no invitation e-mails), the order e-mails held back while he
// was off (send or not), and every status change he made.
export default async function PartnerAdminPage() {
  if (!(await isOwner())) redirect("/lr-panel-v8m3q/orders");
  const sb = supabaseAdmin();
  const [partners, log, missed] = await Promise.all([
    sb.from("partners").select("email, name, enabled, notify, invited_at, last_login_at").order("created_at"),
    sb.from("partner_status_log").select("order_ref, old_status, new_status, old_note, new_note, email, changed_at").order("changed_at", { ascending: false }).limit(100),
    sb.from("orders").select("order_ref").is("partner_email_sent_at", null).eq("partner_email_error", PARTNER_PAUSED).order("created_at"),
  ]);
  const anyOn = (partners.data ?? []).some((p) => p.enabled && p.notify);
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
  const lbl = (s?: string | null) => (isPartnerStatus(s) ? PARTNER_STATUS_LABEL[s] : s ?? "—");

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white font-sans">
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="tracking-widest uppercase" style={{ fontFamily: "Georgia, serif", fontSize: "16px" }}>Lorenzo Ricci</p>
            <p className="text-[10px] tracking-[0.25em] uppercase text-white/30 mt-0.5">Admin · Партньор</p>
          </div>
          <form action={logout}><button type="submit" className="text-xs text-white/35 hover:text-white tracking-widest uppercase">Изход ↗</button></form>
        </div>
      </header>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-white/40 mb-3">Партньори (вижда само дамската колекция бижута)</h2>
          {partners.error && <p className="text-red-400 text-sm">Таблицата липсва: пусни supabase/partner_role.sql ({partners.error.message})</p>}
          <div className="flex flex-col divide-y divide-white/10 border border-white/10">
            {(partners.data ?? []).map((p) => (
              <div key={p.email} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.name ? `${p.name} · ` : ""}{p.email}</p>
                  <p className="text-xs text-white/40 mt-1">Последен вход {fmt(p.last_login_at)}</p>
                </div>
                <PartnerToggle email={p.email} enabled={p.enabled} />
              </div>
            ))}
            {!partners.data?.length && <p className="p-4 text-sm text-white/40">Няма партньори.</p>}
          </div>
          <div className="mt-4"><MissedOrders refs={(missed.data ?? []).map((m) => String(m.order_ref))} partnerOn={anyOn} /></div>
          <div className="mt-4"><AddPartnerForm /></div>
          <p className="mt-2 text-xs text-white/40">Никой не получава покана или линк по имейл от тук. Партньорът влиза с паролата си (или си иска линк сам от /partner/login), само докато е включен. Докато е спрян, имейлите за поръчки не се изпращат, а се записват тук.</p>
        </section>
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-white/40 mb-3">Промени от партньора (последни 100)</h2>
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-sm">
              <thead className="text-white/40 text-xs"><tr><th className="text-left p-2">Кога</th><th className="text-left p-2">Поръчка</th><th className="text-left p-2">Статус</th><th className="text-left p-2">Бележка</th><th className="text-left p-2">Кой</th></tr></thead>
              <tbody>
                {(log.data ?? []).map((l, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-2 whitespace-nowrap">{fmt(l.changed_at)}</td>
                    <td className="p-2 whitespace-nowrap">{l.order_ref}</td>
                    <td className="p-2 whitespace-nowrap">{l.old_status === l.new_status ? lbl(l.new_status) : `${lbl(l.old_status)} → ${lbl(l.new_status)}`}</td>
                    <td className="p-2">{l.old_note !== l.new_note ? (l.new_note ?? "") : ""}</td>
                    <td className="p-2 text-white/50">{l.email}</td>
                  </tr>
                ))}
                {!log.data?.length && <tr><td colSpan={5} className="p-3 text-white/40">Още няма промени.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
