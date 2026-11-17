// mail-policy: internal
import { Resend } from "resend";
import { SITE_URL as SITE_ORIGIN } from "./site";

// "New review waiting" e-mail to the OWNER (owner, 17.11.2026). An internal e-mail (Bulgarian, never to a customer), so it is not
// a mail-policy kind. It goes to ONE address only - the owner's - never to the order-notification list (lib/order-notify.ts) and
// never to the partner (lib/partner/email.ts). To change the address, change this constant.
export const REVIEW_NOTIFY_TO = "dserbezov7@gmail.com";
const FROM = "Lorenzo Ricci <noreply@lorenzo-ricci.com>";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PendingReviewMail {
  productSlug: string;
  productName: string;
  name: string;
  rating: number;
  body: string;
  email: string | null;
  photos: number;
}

export const reviewMailSubject = (r: PendingReviewMail) => `Ново ревю за одобрение – ${r.productName} (${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)})`;

export function buildReviewMail(r: PendingReviewMail): string {
  const row = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#666;width:120px;vertical-align:top">${k}</td><td style="padding:8px 0">${v}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin:0 0 4px;font-size:18px">Ново ревю чака одобрение</h2>
  <p style="margin:0 0 18px;color:#666;font-size:13px">Не се вижда на сайта, докато не го одобриш.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row("Продукт", `<strong>${esc(r.productName)}</strong>`)}
    ${row("Име", esc(r.name))}
    ${row("Оценка", `<span style="font-size:16px">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span> (${r.rating}/5)`)}
    ${row("Текст", esc(r.body).replace(/\n/g, "<br>"))}
    ${row("Снимки", r.photos ? `${r.photos} (виж ги в панела)` : "няма")}
    ${row("Имейл", r.email ? esc(r.email) : "не е посочен")}
  </table>
  <p style="margin:24px 0 0"><a href="${SITE_ORIGIN}/lr-panel-v8m3q/reviews" style="display:inline-block;background:#0a0e1f;color:#fff;text-decoration:none;font-size:13px;letter-spacing:.1em;text-transform:uppercase;padding:12px 22px">Отвори ревютата</a></p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee"><p style="font-size:12px;color:#999;margin:0">Lorenzo Ricci · ревюта</p>
</div>`;
}

/** Sends the e-mail; never throws (a mail problem must not lose the review). Returns whether it went out. */
export async function notifyNewReview(r: PendingReviewMail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[review-notify] RESEND_API_KEY not set - no e-mail"); return false; }
  try {
    const { error } = await new Resend(key).emails.send({ from: FROM, to: REVIEW_NOTIFY_TO, subject: reviewMailSubject(r), html: buildReviewMail(r) });
    if (error) { console.error("[review-notify] Resend error:", error); return false; }
    return true;
  } catch (e) {
    console.error("[review-notify] failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
