// mail-policy: internal
// Email notification for every new chronobg (and future ingest-source) order.
// Sent to env CHRONOBG_NOTIFY_EMAIL. A failure is logged but never throws — the
// order is already saved before this is called.
import { Resend } from "resend";

type OrderItem = { name?: string; slug?: string; sku?: string; quantity?: number; price?: number; currency?: string };

export interface IngestNotifyParams {
  orderId: number;
  orderRef: string;
  sourceSite: string;
  customer: { name: string; phone: string; email?: string | undefined | null };
  delivery?: { city?: string; econt_office?: string } | undefined;
  items: OrderItem[];
  total: number | null;
  payment: string;
  needsReview: boolean;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function buildChronobgEmail(p: IngestNotifyParams): string {
  const panelBase = "https://lorenzo-ricci.com";
  const panelUrl = `${panelBase}/lr-panel-v8m3q/orders`;

  const reviewBanner = p.needsReview
    ? `<div style="background:#b45309;color:#fff;padding:14px 20px;border-radius:6px;margin-bottom:16px">
        <strong>⚠️ Поръчката изисква преглед</strong> — артикулите не бяха разпознати автоматично.
      </div>`
    : "";

  const itemRows = p.items.length
    ? p.items
        .map(
          (it) => `<tr>
          <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb">${it.name ?? "-"}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${it.quantity ?? 1}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right">€${Number(it.price ?? 0).toFixed(2)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:9px 12px;color:#9ca3af">Артикулите не са разпознати — виж панела</td></tr>`;

  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><title>Нова поръчка CHRONOBG</title></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f9fafb;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a1a2e;padding:20px 32px">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:.04em">CHRONOBG · Нова поръчка</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.5);font-size:12px;letter-spacing:.2em;text-transform:uppercase">#${p.orderRef}</p>
    </div>
    <div style="padding:28px 32px">
      ${reviewBanner}
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
        <tr style="background:#f3f4f6"><td style="padding:9px 12px;font-weight:600;width:150px">Клиент</td><td style="padding:9px 12px">${p.customer.name}</td></tr>
        <tr><td style="padding:9px 12px;font-weight:600">Телефон</td><td style="padding:9px 12px"><a href="tel:${p.customer.phone}" style="color:#1a1a2e;font-weight:700">${p.customer.phone}</a></td></tr>
        ${p.customer.email ? `<tr style="background:#f3f4f6"><td style="padding:9px 12px;font-weight:600">Имейл</td><td style="padding:9px 12px">${p.customer.email}</td></tr>` : ""}
        <tr style="background:#f3f4f6"><td style="padding:9px 12px;font-weight:600">Град</td><td style="padding:9px 12px">${p.delivery?.city ?? "—"}</td></tr>
        <tr><td style="padding:9px 12px;font-weight:600">Офис Еконт</td><td style="padding:9px 12px">${p.delivery?.econt_office ?? "—"}</td></tr>
        <tr style="background:#f3f4f6"><td style="padding:9px 12px;font-weight:600">Плащане</td><td style="padding:9px 12px">${p.payment}</td></tr>
      </table>

      <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#374151">Артикули</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <thead>
          <tr style="background:#1a1a2e;color:#fff">
            <th style="padding:9px 12px;text-align:left">Продукт</th>
            <th style="padding:9px 12px;text-align:center">Бр.</th>
            <th style="padding:9px 12px;text-align:right">Цена</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#f3f4f6;font-weight:700">
            <td colspan="2" style="padding:10px 12px">ОБЩО (наложен платеж)</td>
            <td style="padding:10px 12px;text-align:right">${p.total !== null ? `€${Number(p.total).toFixed(2)}` : "—"}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin:0 0 8px">
        <a href="${panelUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
          Отвори в панела →
        </a>
      </p>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af">Получено: ${new Date().toLocaleString("bg-BG", { timeZone: "Europe/Sofia" })} · ID: ${p.orderId}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendChronobgNotify(p: IngestNotifyParams): Promise<void> {
  const to = process.env.CHRONOBG_NOTIFY_EMAIL;
  if (!to) { console.warn("[ingest-notify] CHRONOBG_NOTIFY_EMAIL not set"); return; }

  const resend = getResend();
  if (!resend) { console.warn("[ingest-notify] RESEND_API_KEY not set"); return; }

  const totalStr = p.total !== null ? `€${Number(p.total).toFixed(2)}` : "—";
  const subject = `Нова поръчка CHRONOBG #${p.orderRef} — ${totalStr}`;

  const { error } = await resend.emails.send({
    from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>",
    to,
    subject,
    html: buildChronobgEmail(p),
  });

  if (error) {
    console.error("[ingest-notify] Resend error:", error);
    throw new Error(String(error));
  }
  console.log("[ingest-notify] chronobg email sent to", to, "order", p.orderRef);
}
