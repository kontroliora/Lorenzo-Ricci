import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminSession, adminDb } from "@/lib/supabase/admin-db";
import { CONFIRM_REQUEST_AUTO, confirmUrl, hasEmail, isNoAnswerTarget, type ConfirmRow } from "@/lib/confirm-request";
import { ConfirmEmailButtons } from "./Buttons";
import { TestOrderButtons } from "./TestButtons";

const TEST_NOTE = "ТЕСТ имейл потвърждение – изтрий";   // same as ./actions.ts

export const dynamic = "force-dynamic";

// Owner only: the "Потвърдете поръчката си" e-mail for "не вдига (1)" / "не вдига (2)" orders (lib/confirm-request.ts).
// Shows who would get it, who has no e-mail address, who was mailed already, plus the test button and the send button.
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

function Table({ rows, showSent }: { rows: ConfirmRow[]; showSent?: boolean }) {
  if (!rows.length) return <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Няма.</p>;
  return (
    <table data-testid="confirm-email-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ color: "rgba(255,255,255,0.45)", textAlign: "left" }}>
        <th style={{ padding: "6px 8px" }}>№</th><th style={{ padding: "6px 8px" }}>Име</th><th style={{ padding: "6px 8px" }}>Имейл</th><th style={{ padding: "6px 8px" }}>Статус</th>{showSent && <th style={{ padding: "6px 8px" }}>Имейл / потвърдено</th>}
      </tr></thead>
      <tbody>{rows.map((o) => (
        <tr key={o.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{o.order_ref ?? o.id}</td>
          <td style={{ padding: "6px 8px" }}>{o.name ?? "—"}</td>
          <td style={{ padding: "6px 8px" }}>{o.email?.trim() || "—"}</td>
          <td style={{ padding: "6px 8px" }}>{o.status === "new" ? `не вдига (${o.call_attempts})` : o.status}</td>
          {showSent && <td style={{ padding: "6px 8px" }}>✉ {fmt(o.confirm_email_sent_at)}{o.email_confirmed_at ? ` · ✓ ${fmt(o.email_confirmed_at)}` : ""}</td>}
        </tr>
      ))}</tbody>
    </table>
  );
}

export default async function ConfirmEmailsPage() {
  const me = await getAdminSession();
  if (me?.role !== "owner") return <div className="min-h-screen bg-[#0a0e1f] text-white p-8">Само за собственика.</div>;
  const sb = await adminDb();
  const { data, error } = await sb.from("orders").select("*").eq("status", "new").eq("call_state", "no_answer").in("call_attempts", [1, 2]).order("created_at", { ascending: false });
  const sentRes = await sb.from("orders").select("*").not("confirm_email_sent_at", "is", null).order("confirm_email_sent_at", { ascending: false }).limit(200);
  const rows = ((data ?? []) as ConfirmRow[]).filter(isNoAnswerTarget);
  const migrated = !sentRes.error;
  const toSend = rows.filter((o) => hasEmail(o) && !o.confirm_email_sent_at);
  const noEmail = rows.filter((o) => !hasEmail(o));
  const sent = ((sentRes.data ?? []) as (ConfirmRow & { notes?: string | null })[]).filter((o) => o.notes !== TEST_NOTE);
  const testRes = await sb.from("orders").select("*").eq("notes", TEST_NOTE).eq("is_manual", true).order("created_at", { ascending: false });
  const tests = (testRes.data ?? []) as ConfirmRow[];

  const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", margin: "28px 0 10px" }}>{children}</h2>;
  return (
    <div className="min-h-screen bg-[#0a0e1f] text-white">
      <AdminNav />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }}>
        <Link href="/lr-panel-v8m3q/orders" style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>← Поръчки</Link>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "10px 0 6px" }}>Имейл „Потвърдете поръчката си“</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          За поръчки „не вдига (1)“ и „не вдига (2)“ (без отказани, изпратени, потвърдени, фалшиви, румънски). Всяка поръчка получава имейла само веднъж.
          Автоматично при „Не вдига“: <b style={{ color: CONFIRM_REQUEST_AUTO ? "#C0DD97" : "#F09595" }}>{CONFIRM_REQUEST_AUTO ? "ВКЛЮЧЕНО" : "ИЗКЛЮЧЕНО"}</b>.
        </p>
        {error && <p style={{ color: "#F09595" }}>Грешка: {error.message}</p>}
        {!migrated && <p data-testid="confirm-email-migration" style={{ color: "#F09595", fontSize: 13 }}>Липсват колоните confirm_email_sent_at / email_confirmed_at: пусни supabase/orders_email_confirm.sql в Supabase. Дотогава нищо не се праща.</p>}

        <H>За изпращане: {toSend.length}</H>
        <Table rows={toSend} />
        {migrated && <ConfirmEmailButtons testOrderId={toSend[0]?.id ?? rows[0]?.id ?? null} count={toSend.length} />}

        <H>Без имейл: {noEmail.length}</H>
        <Table rows={noEmail} />

        <H>Вече изпратени: {sent.length}</H>
        <Table rows={sent} showSent />

        <H>Тест (само собственикът)</H>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>Тестова поръчка с твоя имейл: натисни „Не вдига“ на картата ѝ в „Поръчки“ – имейлът трябва да тръгне сам. Без наличност, партньорът не я вижда.</p>
        {tests.map((o) => (
          <div key={o.id} data-testid="test-order" style={{ fontSize: 13, margin: "8px 0", lineHeight: 1.7 }}>
            <span style={{ fontFamily: "monospace" }}>{o.order_ref}</span> · статус <b>{o.status}</b> / {o.call_state} · опити {o.call_attempts} · ✉ {fmt(o.confirm_email_sent_at)} · ✓ {fmt(o.email_confirmed_at)}
            {o.status === "new" && o.confirm_email_sent_at && <> · <a data-testid="test-confirm-link" href={confirmUrl(o.id) ?? "#"} target="_blank" style={{ color: "#85B7EB" }}>линк за потвърждение</a></>}
          </div>
        ))}
        <TestOrderButtons hasTest={tests.length > 0} />
      </main>
    </div>
  );
}
