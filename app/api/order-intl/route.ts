import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { buildWaitlistEmail, waitlistSubject } from "@/lib/waitlist-email";

export const dynamic = "force-dynamic";

// ============================================================================
// International "soft decline" order (Dubai test market).
//
// A PARALLEL path to /api/order — the Bulgarian COD/Econt flow is untouched.
// The customer completes a real-looking checkout (COD amount shown, for an
// honest intent signal), but no stock is reserved and no fulfilment follows.
// Instead we:
//   1. capture the order as a lead (is_international = true → never enters the
//      normal Econt / "за изпълнение" queue; shows in the panel's Международни view),
//   2. issue a 5% apology code (never expires) and email a restrained
//      "temporarily out of stock" note,
//   3. fire a Meta **Lead** event (not Purchase — it isn't a sale) so ad delivery
//      can still optimise toward people who reach real purchase intent.
// ============================================================================

const META_PIXEL_ID = "661480326560209";
const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[order-intl] RESEND_API_KEY not set — skipping email"); return null; }
  return new Resend(key);
}

type LeadCtx = { ip?: string; userAgent?: string; fbc?: string; fbp?: string };

// Meta Conversions API — server-side Lead event (mirrors sendCapiPurchase, but
// event_name = "Lead" and the destination country is the UAE).
async function sendCapiLead(
  opts: { customer: Record<string, unknown>; items: Array<{ sku?: string }>; ref: string; value: number },
  ctx: LeadCtx,
): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) { console.warn("[order-intl] META_CAPI_ACCESS_TOKEN not set — skipping Lead"); return; }

  const c = opts.customer;
  const nameParts = String(c.name ?? "").trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");

  const userData: Record<string, unknown> = { country: ["ae"] };
  const email = String(c.email ?? "").trim();
  const phone = String(c.phone ?? "").replace(/\D/g, "");
  if (email)     userData.em = [sha256(email)];
  if (phone)     userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName.toLowerCase())];
  if (lastName)  userData.ln = [sha256(lastName.toLowerCase())];
  const city = String(c.city ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (city) userData.ct = [sha256(city)];
  if (ctx.ip)        userData.client_ip_address = ctx.ip;
  if (ctx.userAgent) userData.client_user_agent = ctx.userAgent;
  if (ctx.fbc)       userData.fbc = ctx.fbc;
  if (ctx.fbp)       userData.fbp = ctx.fbp;

  const payload = {
    data: [{
      event_name:       "Lead",
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         opts.ref, // dedups with any browser-side Lead of the same id
      event_source_url: "https://lorenzo-ricci.com",
      action_source:    "website",
      user_data:        userData,
      custom_data: {
        value:        opts.value,
        currency:     "EUR",
        content_ids:  opts.items.map((i) => i.sku ?? "").filter(Boolean),
        content_type: "product",
      },
    }],
    access_token: token,
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`CAPI Lead ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  console.log("[order-intl] Lead sent");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const customer = (body.customer ?? {}) as Record<string, unknown>;
    const shipping = (body.shipping ?? {}) as Record<string, unknown>;
    const items = Array.isArray(body.items) ? (body.items as Array<{ sku?: string; name?: string }>) : [];

    const email = String(customer.email ?? "").trim();
    const ref   = String(body.orderRef ?? "").trim();

    if (items.length === 0 || !email.includes("@") || !ref) {
      return NextResponse.json({ ok: false, error: "Missing items, email or order reference" }, { status: 400 });
    }

    // 1. Capture the lead. No reserve_wallet_stock — the piece is "out of stock"
    //    by premise. status is left to the column default ("new"); is_international
    //    keeps it out of every normal queue.
    const orderRow: Record<string, unknown> = {
      order_ref:               ref,
      name:                    String(customer.name ?? ""),
      phone:                   String(customer.phone ?? ""),
      email:                   email || null,
      city:                    String(customer.city ?? ""),
      post_code:               String(customer.postCode ?? ""),
      address:                 String(customer.address ?? ""),
      ship_country:            String(customer.country ?? "") || null,
      shipping_method:         String(shipping.method ?? "International shipping"),
      courier:                 "international",
      items,
      subtotal:                Number(body.subtotal ?? 0),
      shipping_cost:           Number(shipping.cost ?? 0),
      total:                   Number(body.total ?? 0),
      email_marketing_consent: Boolean(customer.emailMarketingConsent),
      is_international:         true,
    };
    const { error: dbError } = await supabase.from("orders").insert(orderRow);
    if (dbError) {
      // The lead is the deliverable — losing it is loud, not silent.
      console.error("[order-intl] Failed to save lead:", dbError.message);
      await alertOwner(ref, email, dbError.message);
    }

    // 2. Issue the 5% apology code (never expires). Reuses the promo mechanism.
    let promoCode = "";
    let discount = 0.05;
    const { data: codeRow, error: codeErr } = await supabase
      .rpc("waitlist_issue_code", { p_email: email })
      .single();
    if (codeErr) console.error("[order-intl] waitlist_issue_code error:", codeErr.message);
    const cr = codeRow as { out_promo_code?: string; out_discount?: number } | null;
    if (cr?.out_promo_code) { promoCode = cr.out_promo_code; discount = Number(cr.out_discount ?? 0.05); }

    // 3. Soft-decline email + Meta Lead, in parallel — neither blocks the response.
    const ctx: LeadCtx = {
      ip:        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      fbc:       req.cookies.get("_fbc")?.value,
      fbp:       req.cookies.get("_fbp")?.value,
    };
    await Promise.allSettled([
      promoCode ? sendWaitlistEmail(email, buildWaitlistEmail({
        firstName:   String(customer.name ?? "").split(" ")[0],
        itemNames:   items.map((i) => String(i.name ?? "")).filter(Boolean),
        promoCode,
        discountPct: Math.round(discount * 100),
      })) : Promise.resolve(),
      sendCapiLead({ customer, items, ref, value: Number(body.total ?? 0) }, ctx),
    ]);

    // The frontend shows the "temporarily out of stock" screen regardless.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[order-intl] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to process" }, { status: 500 });
  }
}

async function sendWaitlistEmail(to: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { error } = await resend.emails.send({
    from: "Lorenzo Ricci <info@lorenzo-ricci.com>",
    to, subject: waitlistSubject, html,
  });
  if (error) throw new Error(String(error));
}

// Owner alert when the lead row fails to save (the email already went out).
async function alertOwner(ref: string, email: string, reason: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>",
    to: "info@lorenzo-ricci.com",
    subject: `🚨 [МЕЖДУНАРОДНА НЕ Е ЗАПИСАНА] ${ref}`,
    html: `<p>Международна поръчка ${ref} (${email}) не влезе в базата.</p><p>Причина: ${reason}</p>`,
  }).catch(() => {});
}
