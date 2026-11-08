// mail-policy: internal
import { Resend } from "resend";

// Partner order e-mail (BG + RO): one per order to the partner. Its OWN template, separate from the team e-mail
// (lib/order-notify.ts buildAdminEmail / lib/ro/emails.ts buildRoAdminEmail), which stays as it is.
// Carries the customer's phone but NO e-mail of the customer (owner, 08.11.2026). Not a customer e-mail: Bulgarian text.

export const PARTNER_RECIPIENTS = ["dejvidvisev99@gmail.com"];

export type PartnerOrder = {
  orderRef: string;
  date: Date | string;                       // when the order was placed
  name: string;
  phone: string;
  market: "bg" | "ro";
  delivery: { method: string; office: boolean; address: string; city?: string; postCode?: string };
  items: { name?: string; sku?: string; quantity?: number; price?: number; gift?: boolean }[];
  total: number;
  payment: "cod" | "card";
  status: string;                            // e.g. "Нова - чака потвърждение" / "Платена"
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number, market: PartnerOrder["market"]) => market === "ro" ? `${Math.round(n)} lei` : `€${n.toFixed(2)}`;
const fmtDate = (d: Date | string) => new Date(d).toLocaleString("bg-BG", { timeZone: "Europe/Sofia", dateStyle: "short", timeStyle: "short" });

export function partnerSubject(o: PartnerOrder): string {
  return `${o.market === "ro" ? "🇷🇴 " : ""}Поръчка ${o.orderRef} - ${o.name}`;
}

export function buildPartnerEmail(o: PartnerOrder): string {
  const courier = o.market === "ro" ? "Speedy" : "Еконт";
  const where = [o.delivery.address, o.delivery.city, o.delivery.postCode].map((s) => String(s ?? "").trim()).filter(Boolean)
    .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i).join(", ");
  const row = (k: string, v: string, shade: boolean) =>
    `<tr${shade ? ' style="background:#f3f4f6"' : ""}><td style="padding:9px 12px;font-weight:600;width:160px;vertical-align:top">${k}</td><td style="padding:9px 12px">${v}</td></tr>`;
  const lines = o.items.map((i) => `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">${esc(i.name ?? "-")}${i.gift ? ' <span style="color:#047857">(подарък)</span>' : ""}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#555">${esc(i.sku ?? "-")}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${Number(i.quantity ?? 1)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${i.gift ? "0" : esc(money(Number(i.price ?? 0), o.market))}</td>
    </tr>`).join("");
  const payment = o.payment === "card" ? "Карта (платена онлайн) - куриерът събира 0" : "Наложен платеж - куриерът събира сумата";

  return `<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8"><title>${esc(partnerSubject(o))}</title></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f9fafb;color:#111">
 <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#0a0e1f;padding:20px 28px;color:#fff"><strong style="letter-spacing:.2em">LORENZO RICCI</strong>
   <span style="opacity:.65;margin-left:10px">${o.market === "ro" ? "🇷🇴 Румъния" : "🇧🇬 България"} · Поръчка ${esc(o.orderRef)}</span></div>
  <div style="padding:28px">
   <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
    ${row("Номер", `<strong>${esc(o.orderRef)}</strong>`, true)}
    ${row("Дата", esc(fmtDate(o.date)), false)}
    ${row("Клиент", esc(o.name || "-"), true)}
    ${row("Телефон", o.phone ? `<a href="tel:${esc(o.phone)}" style="color:#0a0e1f;font-weight:600">${esc(o.phone)}</a>` : "-", false)}
    ${row("Доставка", `${esc(courier)} - ${o.delivery.office ? "до офис / автомат" : "до адрес"}`, true)}
    ${row(o.delivery.office ? `Офис ${esc(courier)}` : "Адрес", esc(where || "-"), false)}
    ${row("Плащане", esc(payment), true)}
    ${row("Статус", `<strong>${esc(o.status)}</strong>`, false)}
   </table>
   <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#0a0e1f;color:#fff"><th style="padding:9px 12px;text-align:left">Продукт</th><th style="padding:9px 12px;text-align:left">SKU</th><th style="padding:9px 12px">Бр.</th><th style="padding:9px 12px;text-align:right">Цена</th></tr></thead>
    <tbody>${lines || '<tr><td colspan="4" style="padding:9px 12px">-</td></tr>'}</tbody>
    <tfoot><tr style="background:#f3f4f6;font-weight:700"><td colspan="3" style="padding:10px 12px">ОБЩО${o.payment === "card" ? " (платено)" : " (наложен платеж)"}</td><td style="padding:10px 12px;text-align:right">${esc(money(o.total, o.market))}</td></tr></tfoot>
   </table>
  </div>
 </div>
</body></html>`;
}

/** Sends the partner e-mail. Throws on a Resend error (callers run it inside Promise.allSettled, like the team e-mail). */
export async function sendPartnerEmail(o: PartnerOrder): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[partner] RESEND_API_KEY not set - skipping e-mail"); return; }
  const { error } = await new Resend(key).emails.send({
    from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>",
    to: PARTNER_RECIPIENTS,
    subject: partnerSubject(o),
    html: buildPartnerEmail(o),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
