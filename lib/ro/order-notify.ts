// mail-policy: order_confirmation, card_paid
import { Resend } from "resend";
import { buildUserData, eventSourceUrl, mayPostPurchase, sendCapiEvents, type CapiContext } from "../meta-capi";
import { RO_CURRENCY } from "./config";
import { mayEmail, type MailKind } from "../mail-policy";
import type { RoOrderEmailData } from "./emails";

// Romanian order notifications shared by /api/order-ro (ramburs) and the Stripe webhook (card orders, once paid).
export const RO_ADMIN_RECIPIENTS = ["info@lorenzo-ricci.com", "sodolos3@gmail.com", "pavelserbezov03@gmail.com"]; // same three as /api/order
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export type RoCapiContext = CapiContext;

/** `kind` = a CUSTOMER e-mail (Romanian templates, language rule in lib/mail-policy.ts); leave it out for the Bulgarian team e-mail. */
export async function sendMail(opts: { from: string; to: string[]; subject: string; html: string }, kind?: MailKind): Promise<void> {
  if (kind && !mayEmail(kind, "ro", "ro")) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[order-ro] RESEND_API_KEY not set - skipping e-mail"); return; }
  const { error } = await new Resend(key).emails.send(opts);
  if (error) throw new Error(`Resend: ${error.message}`);
}

// Meta Conversions API Purchase in RON, deduplicated with the browser pixel through event_id = order reference.
export async function sendCapiPurchase(o: RoOrderEmailData & { skus: string[] }, ctx: RoCapiContext): Promise<void> {
  if (!process.env.META_CAPI_ACCESS_TOKEN) { console.warn("[order-ro] META_CAPI_ACCESS_TOKEN not set - skipping Purchase"); return; }
  if (!mayPostPurchase()) { console.warn("[order-ro] not a production deployment - Purchase not sent to Meta"); return; }
  const c = o.customer;
  const parts = str(c.name).split(/\s+/);
  const result = await sendCapiEvents([{
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: o.orderRef,
    event_source_url: eventSourceUrl(ctx.sourceUrl, "/ro"),
    action_source: "website",
    user_data: buildUserData("ro", ctx, {
      email: str(c.email),
      phone: str(c.phone),                 // 0712... is normalised to 40712... before hashing
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      city: str(c.city),
      zip: str(c.postCode),
    }),
    custom_data: {
      value: o.total,
      currency: RO_CURRENCY,
      content_ids: o.skus,
      content_type: "product",
      content_category: "RO",
      order_id: o.orderRef,
    },
  }]);
  if (!result.ok) throw new Error(`CAPI ${result.status}: ${JSON.stringify(result.body).slice(0, 200)}`);
}

