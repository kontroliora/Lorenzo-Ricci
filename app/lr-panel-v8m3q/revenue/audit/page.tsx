import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminNav } from "@/components/admin/AdminNav";
import { isOwner } from "@/lib/admin-auth";
import { getRevenueAudit, fixDeliveryDates } from "@/lib/revenue-audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Оборот → Проверка (owner, 14.11.2026): the revenue tab's numbers cross-checked against Econt, Stripe and Meta. Read-only, except the
// one button that moves completed_at of Econt-delivered parcels to Econt's real delivery time (lib/revenue-audit.ts).
async function fixDates() {
  "use server";
  if (!(await isOwner())) return;
  await fixDeliveryDates();
  revalidatePath("/lr-panel-v8m3q/revenue");
  revalidatePath("/lr-panel-v8m3q/revenue/audit");
}

const eur = (n: number) => "€" + Number(n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_BG: Record<string, string> = {
  new: "нова", confirmed: "потвърдена", shipped: "изпратена", completed: "доставена", cancelled: "отказана",
  returned: "върната", returning: "връща се (невзета)", restocked: "върната на склад", pending_payment: "чака плащане",
};

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "13px 16px" }}>
      <h2 style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}
function Lines({ rows, empty = "няма" }: { rows: { ref: string; status: string; eur: number; note: string }[]; empty?: string }) {
  if (!rows.length) return <p style={{ color: "#7DD3A8", fontSize: 13 }}>✓ {empty}</p>;
  return (
    <table style={{ width: "100%", fontSize: 12 }}><tbody>
      {rows.map((r, i) => (
        <tr key={i} style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <td style={{ padding: "4px 6px", color: "#fff" }}>{r.ref}</td>
          <td style={{ padding: "4px 6px", color: "rgba(255,255,255,0.6)" }}>{STATUS_BG[r.status] ?? r.status}</td>
          <td style={{ padding: "4px 6px", color: "#FAC775", textAlign: "right" }}>{eur(r.eur)}</td>
          <td style={{ padding: "4px 6px", color: "rgba(255,255,255,0.5)" }}>{r.note}</td>
        </tr>
      ))}
    </tbody></table>
  );
}

export default async function RevenueAuditPage() {
  if (!(await isOwner())) redirect("/lr-panel-v8m3q/orders");
  const a = await getRevenueAudit();
  if (!a) redirect("/lr-panel-v8m3q/orders");
  const sum = (rows: { count: number; collected: number; goods: number }[]) => rows.reduce((s, r) => ({ count: s.count + r.count, collected: s.collected + r.collected, goods: s.goods + r.goods }), { count: 0, collected: 0, goods: 0 });

  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <AdminNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4" id="revenue-audit">
        <h1 style={{ fontSize: 18 }}>Проверка на оборота · {a.months.prev} и {a.months.cur} (до {a.today})</h1>
        {a.errors.length > 0 && <p style={{ color: "#F09595", fontSize: 12 }}>Грешки: {a.errors.join(" · ")}</p>}

        {(["cur", "prev"] as const).map((k) => {
          const rows = a.statuses[k]; const t = sum(rows);
          return (
            <Box key={k} title={`Поръчки по статус · направени през ${a.months[k]} (без тестови и неплатени карти)`}>
              <table style={{ width: "100%", fontSize: 13 }}><thead><tr style={{ color: "rgba(255,255,255,0.4)" }}><th align="left">статус</th><th align="right">бр.</th><th align="right">събрано</th><th align="right">стока</th></tr></thead><tbody>
                {rows.map((r) => <tr key={r.status}><td>{STATUS_BG[r.status] ?? r.status}</td><td align="right">{r.count}</td><td align="right">{eur(r.collected)}</td><td align="right">{eur(r.goods)}</td></tr>)}
                <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.2)", fontWeight: 600 }}><td>общо</td><td align="right">{t.count}</td><td align="right">{eur(t.collected)}</td><td align="right">{eur(t.goods)}</td></tr>
              </tbody></table>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                Оборот таб брои <b>доставени по дата на доставяне</b> през {a.months[k]}: {a.tab[k].count} бр · стока {eur(a.tab[k].goods)} · събрано {eur(a.tab[k].collected)}
              </p>
            </Box>
          );
        })}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Извън числата: {a.excluded.tests} маркирани тестови/фалшиви · {a.excluded.attempts} неплатени опита с карта · {a.excluded.leads} международни заявки.</p>

        <Box title={`Еконт · проверени ${a.econt.answered}/${a.econt.checked} товарителници`}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Доставени с наложен платеж в Еконт ({a.months.prev}–днес): {a.econt.econtCodDelivered.count} бр · {eur(a.econt.econtCodDelivered.cod)}</p>
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Доставени в Еконт, но при нас НЕ са „доставена“ (липсват в оборота)</h3>
          <Lines rows={a.econt.econtDeliveredNotCompleted} />
          <h3 style={{ fontSize: 13, marginTop: 8 }}>„Доставена“ при нас, но Еконт не казва доставена</h3>
          <Lines rows={a.econt.completedNotDeliveredInEcont} />
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Върнати в Еконт, при нас живи</h3>
          <Lines rows={a.econt.econtReturnedButLive} />
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Изпратени/доставени без товарителница (Еконт не може да ги потвърди)</h3>
          <Lines rows={a.econt.shippedNoAwb} />
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Доставени в друг месец, отколкото е записано при нас</h3>
          <Lines rows={a.econt.wrongMonth.map((w) => ({ ...w, note: `при нас ${w.ours} · Еконт ${w.econt}` }))} />
          {a.econt.dateFixes > 0 && (
            <form action={fixDates} style={{ marginTop: 8 }}>
              <button type="submit" id="fix-delivery-dates" style={{ fontSize: 12, padding: "6px 12px", border: "1px solid #FAC775", color: "#FAC775", borderRadius: 6 }}>
                Поправи датата на доставяне на {a.econt.dateFixes} поръчки по Еконт
              </button>
            </form>
          )}
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Пратки в Еконт без поръчка при нас ({a.econt.econtOrphans.length})</h3>
          {a.econt.econtOrphans.length === 0 ? <p style={{ color: "#7DD3A8", fontSize: 13 }}>✓ няма</p> : (
            <table style={{ width: "100%", fontSize: 12 }}><tbody>{a.econt.econtOrphans.map((o) => <tr key={o.awb}><td>{o.awb}</td><td>{o.created}</td><td align="right">{eur(o.cod)}</td><td>{o.status}</td></tr>)}</tbody></table>
          )}
        </Box>

        <Box title={`Stripe · ${a.stripe.paid.count} платени сесии · ${eur(a.stripe.paid.eur)}`}>
          <h3 style={{ fontSize: 13 }}>Платени в Stripe без поръчка</h3>
          {a.stripe.stripePaidNoOrder.length === 0 ? <p style={{ color: "#7DD3A8", fontSize: 13 }}>✓ няма</p> : (
            <table style={{ width: "100%", fontSize: 12 }}><tbody>{a.stripe.stripePaidNoOrder.map((s) => <tr key={s.session}><td>{s.ref ?? "—"}</td><td>{s.created}</td><td align="right">{s.amount}</td><td>{s.session}</td></tr>)}</tbody></table>
          )}
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Платени в Stripe, но поръчката е отказана/върната/тестова</h3>
          <Lines rows={a.stripe.stripePaidOrderNotSale} />
          <h3 style={{ fontSize: 13, marginTop: 8 }}>Отбелязани платени при нас без платена сесия</h3>
          <Lines rows={a.stripe.orderPaidNoStripe} />
        </Box>

        <Box title="Отстъпки 1+1, подаръци, промо кодове">
          <Lines rows={a.pricing} empty="всички поръчки: стоката = тотал − доставка ≤ сбора на редовете, подаръците са с цена 0" />
        </Box>
        <Box title="Може би тестови, но НЕ са маркирани (влизат в числата)">
          <Lines rows={a.suspectedTests} />
        </Box>

        <Box title={`Meta реклама · Meta сега ${eur(a.meta.cur.live)} / при нас ${eur(a.meta.cur.synced)} (${a.months.cur}) · ${eur(a.meta.prev.live)} / ${eur(a.meta.prev.synced)} (${a.months.prev})`}>
          <table style={{ width: "100%", fontSize: 12 }}><thead><tr style={{ color: "rgba(255,255,255,0.4)" }}><th align="left">ден</th><th align="right">Meta (Ads Manager)</th><th align="right">при нас</th><th align="right">разлика</th></tr></thead><tbody>
            {a.meta.days.map((d) => { const diff = Math.round((d.live - d.synced) * 100) / 100; return (
              <tr key={d.day} style={{ color: Math.abs(diff) >= 1 ? "#F0B37E" : "rgba(255,255,255,0.7)" }}><td>{d.day}</td><td align="right">{eur(d.live)}</td><td align="right">{eur(d.synced)}</td><td align="right">{diff ? eur(diff) : "✓"}</td></tr>
            ); })}
          </tbody></table>
        </Box>

        <Box title={`Имейли с проблем · последните 24 ч (${a.emails.length})`}>
          {a.emails.length === 0 ? <p style={{ color: "#7DD3A8", fontSize: 13 }}>✓ няма</p> : (
            <table style={{ width: "100%", fontSize: 12 }}><tbody>{a.emails.map((e, i) => <tr key={i}><td>{e.at.slice(11, 16)}</td><td>{e.type}</td><td>{e.recipient}</td><td>{e.subject}</td><td>{e.reason}</td></tr>)}</tbody></table>
          )}
        </Box>
      </main>
    </div>
  );
}
