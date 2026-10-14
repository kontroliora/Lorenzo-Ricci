import { Resend } from "resend";
import { createHash } from "crypto";
import { RO_CURRENCY } from "./config";
import type { RoOrderEmailData } from "./emails";

// Romanian order notifications shared by /api/order-ro (ramburs) and the Stripe webhook (card orders, once paid).
const META_PIXEL_ID = "661480326560209";
export const RO_ADMIN_RECIPIENTS = ["info@lorenzo-ricci.com", "sodolos3@gmail.com", "pavelserbezov03@gmail.com"]; // same three as /api/order
const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export type RoCapiContext = { ip?: string; userAgent?: string; fbc?: string; fbp?: string };

export async function sendMail(opts: { from: string; to: string[]; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[order-ro] RESEND_API_KEY not set - skipping e-mail"); return; }
  const { error } = await new Resend(key).emails.send(opts);
  if (error) throw new Error(`Resend: ${error.message}`);
}

// Meta Conversions API Purchase in RON, deduplicated with the browser pixel through event_id = order reference.
export async function sendCapiPurchase(o: RoOrderEmailData & { skus: string[] }, ctx: RoCapiContext): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) { console.warn("[order-ro] META_CAPI_ACCESS_TOKEN not set - skipping Purchase"); return; }
  if (process.env.VERCEL_ENV === "preview") { console.warn("[order-ro] preview deployment - Purchase not sent to Meta"); return; }
  const c = o.customer;
  const parts = str(c.name).split(/\s+/);
  const userData: Record<string, unknown> = { country: [sha256("ro")] };
  if (c.email) userData.em = [sha256(c.email)];
  if (c.phone) userData.ph = [sha256("4" + "0" + String(c.phone).replace(/^0/, ""))]; // E.164 digits without "+"
  if (parts[0]) userData.fn = [sha256(parts[0])];
  if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(" "))];
  if (c.city) userData.ct = [sha256(String(c.city).replace(/\s+/g, ""))];
  if (c.postCode) userData.zp = [sha256(String(c.postCode).replace(/\s+/g, ""))];
  if (ctx.ip) userData.client_ip_address = ctx.ip;
  if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
  if (ctx.fbc) userData.fbc = ctx.fbc;
  if (ctx.fbp) userData.fbp = ctx.fbp;

  const res = await fetch(`https://graph.facebook.com/v26.0/${META_PIXEL_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: o.orderRef,
        event_source_url: "https://lorenzo-ricci.com/ro",
        action_source: "website",
        user_data: userData,
        custom_data: {
          value: o.total,
          currency: RO_CURRENCY,
          content_ids: o.skus,
          content_type: "product",
          content_category: "RO",
          order_id: o.orderRef,
        },
      }],
      access_token: token,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`CAPI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

