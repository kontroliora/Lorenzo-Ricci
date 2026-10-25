// mail-policy: order_confirmed, order_cancelled, order_delivered, order_returned, shipment_shipped
//
// E-mails to a Romanian customer for every action staff take in the panel (Поръчки): confirmed, shipped (AWB), delivered, returned,
// cancelled. Always Romanian. Called by the panel server actions (app/lr-panel-v8m3q/orders/actions.ts) only after the status really
// changed, and only for Romanian orders: for any other order (Bulgarian) this does nothing, so no Bulgarian text can reach a Romanian
// customer and no Romanian text a Bulgarian one. A mail problem never undoes the status change: it comes back as a warning text.
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { langOf, mayEmail, type MailKind } from "@/lib/mail-policy";
import { hasCardMoney, isCard } from "@/lib/payments";
import {
  buildRoConfirmedEmail, buildRoCancelledEmail, buildRoDeliveredEmail, buildRoReturnedEmail, buildRoShippedEmail,
  roConfirmedSubject, roCancelledSubject, roDeliveredSubject, roReturnedSubject, roShippedSubject, type RoCancelCategory, type RoPayment,
} from "@/lib/ro/emails";

export type RoPanelMail =
  | { kind: "order_confirmed" }
  | { kind: "order_cancelled"; category?: RoCancelCategory | string; refundLabel?: string }
  | { kind: "order_delivered" }
  | { kind: "order_returned" }
  | { kind: "shipment_shipped"; awb: string; trackUrl?: string };

type Row = {
  id: number; order_ref: string | null; name: string | null; email: string | null; items: unknown; total: number | null;
  ship_country: string | null; tracking_number: string | null;
  payment_method: string | null; payment_status: string | null; stripe_payment_intent: string | null;
};

const FROM = "Lorenzo Ricci <info@lorenzo-ricci.com>";

/** How the order is paid (see RoPayment in lib/ro/emails.ts): Romania is card only, "ramburs" is left only for orders placed before 25.10.2026. */
const roPaymentOf = (o: Row): RoPayment => (hasCardMoney(o) ? "card" : isCard(o) ? "unknown" : "ramburs");

/** Sends the Romanian e-mail for `mail` about order `orderId`. Returns null (sent, or nothing to send) or a warning for the panel. */
export async function sendRoPanelMail(sb: SupabaseClient, orderId: number, mail: RoPanelMail): Promise<string | null> {
  const { data, error } = await sb.from("orders")
    .select("id, order_ref, name, email, items, total, ship_country, tracking_number, payment_method, payment_status, stripe_payment_intent").eq("id", orderId).single();
  if (error || !data) return `Статусът е променен, но не успях да прочета поръчката за имейла (${error?.message ?? "не е намерена"}).`;
  const o = data as Row;
  if (langOf(o) !== "ro") return null;                         // not a Romanian order: this module never mails it
  if (!o.email) return "Статусът е променен, но поръчката няма имейл - клиентът не е уведомен.";
  const kind: MailKind = mail.kind;
  if (!mayEmail(kind, "ro", "ro")) return null;                 // no Romanian version registered: do not send (never a Bulgarian fallback)

  const ref = o.order_ref ?? String(o.id);
  const firstName = String(o.name ?? "").trim().split(" ")[0];
  const items = Array.isArray(o.items) ? (o.items as { name?: string; quantity?: number; price?: number; gift?: boolean }[]).filter((i) => !i.gift) : [];
  const total = Number(o.total ?? 0);
  const payment = roPaymentOf(o);   // paid by card: the e-mails say there is nothing to pay on delivery

  let subject: string; let html: string;
  switch (mail.kind) {
    case "order_confirmed": subject = roConfirmedSubject(ref); html = buildRoConfirmedEmail({ orderRef: ref, firstName, items, total, payment }); break;
    case "order_cancelled": subject = roCancelledSubject(ref); html = buildRoCancelledEmail({ orderRef: ref, firstName, category: mail.category, refundLabel: mail.refundLabel }); break;
    case "order_delivered": subject = roDeliveredSubject(ref); html = buildRoDeliveredEmail({ orderRef: ref, firstName }); break;
    case "order_returned": subject = roReturnedSubject(ref); html = buildRoReturnedEmail({ orderRef: ref, firstName }); break;
    case "shipment_shipped": subject = roShippedSubject(ref); html = buildRoShippedEmail({ orderRef: ref, firstName, items, total, payment, awb: mail.awb, trackUrl: mail.trackUrl }); break;
  }

  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY липсва");
    const { error: mailErr } = await new Resend(key).emails.send({ from: FROM, to: [o.email], subject, html });
    if (mailErr) throw new Error(mailErr.message);
    return null;
  } catch (e) {
    return `Статусът е променен, но имейлът към клиента (на румънски) не излезе: ${e instanceof Error ? e.message : String(e)}.`;
  }
}
