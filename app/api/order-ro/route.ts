import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProductBySlug } from "@/lib/products";
import { getPriceOverrides, applyOverride } from "@/lib/price-overrides";
import { checkOrderable } from "@/lib/order-availability";
import { roEligible, ronOf } from "@/lib/ro/config";
import { roSubtotal, roShippingCost, roTotal } from "@/lib/ro/pricing";
import { RO_COUNTIES } from "@/lib/ro/counties";
import { RO_CURRENCY } from "@/lib/ro/config";
import { buildRoCustomerEmail, buildRoAdminEmail, roCustomerSubject, type RoOrderEmailData } from "@/lib/ro/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order-ro - Romanian market test: cash on delivery (ramburs), prices in lei.
//
// A PARALLEL path to /api/order (the Bulgarian COD/Econt flow is untouched). Same safety rules:
//   1. every price, total and the delivery fee are RE-DERIVED here from the catalog + price overrides
//      (EUR price x 5.25, whole lei) - the browser's numbers must match to the leu, else 409;
//   2. catalog gates (inStock off switch, Romanian assortment) before anything with a side effect;
//   3. stock is reserved with the same atomic reserve_wallet_stock (all-or-nothing under a row lock);
//   4. the order is inserted BEFORE the e-mails; if the insert fails the stock is put back and the customer is told;
//   5. a repeated orderRef is answered with success without reserving or inserting twice.
// The order is stored with is_international = true and ship_country = 'RO': it stays out of the Bulgarian board and
// out of every Econt cron, and appears in the panel tab "Румъния". Amounts in `total`/`subtotal`/`shipping_cost` are lei.
// ─────────────────────────────────────────────────────────────────────────────

const META_PIXEL_ID = "661480326560209";
const ADMIN_RECIPIENTS = ["info@lorenzo-ricci.com", "sodolos3@gmail.com", "pavelserbezov03@gmail.com"]; // same three as /api/order
const MAX_QTY = 10;

const fail = (status: number, code: string, error: string) => NextResponse.json({ success: false, code, error }, { status });
const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

function stockMessage(items: { name: string; available: number }[]): string {
  const parts = items.map((s) => (s.available <= 0 ? `Pentru ${s.name} nu mai există stoc` : `Din ${s.name} mai sunt disponibile doar ${s.available} ${s.available === 1 ? "bucată" : "bucăți"}`));
  return `${parts.join(". ")}. Vă rugăm să ajustați cantitatea din coș.`;
}

// Romanian mobile numbers: 07xxxxxxxx, +407xxxxxxxx, 00407xxxxxxxx, 407xxxxxxxx -> 07xxxxxxxx.
function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const national = d.startsWith("0040") ? "0" + d.slice(4) : d.startsWith("40") && d.length === 11 ? "0" + d.slice(2) : d;
  return /^07\d{8}$/.test(national) ? national : null;
}

async function sendMail(opts: { from: string; to: string[]; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[order-ro] RESEND_API_KEY not set - skipping e-mail"); return; }
  const { error } = await new Resend(key).emails.send(opts);
  if (error) throw new Error(`Resend: ${error.message}`);
}

// Meta Conversions API Purchase in RON, deduplicated with the browser pixel through event_id = order reference.
async function sendCapiPurchase(o: RoOrderEmailData & { skus: string[] }, ctx: { ip?: string; userAgent?: string; fbc?: string; fbp?: string }): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) { console.warn("[order-ro] META_CAPI_ACCESS_TOKEN not set - skipping Purchase"); return; }
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

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(400, "bad_request", "Cerere invalidă. Vă rugăm să reîncercați."); }

    // ── 1. Shape of the request ───────────────────────────────────────────────
    const ref = str(body.orderRef, 20);
    if (!/^LRRO-[A-Z0-9]{4,10}$/.test(ref)) return fail(400, "bad_request", "Cerere invalidă. Vă rugăm să reîncărcați pagina.");

    const cu = (body.customer ?? {}) as Record<string, unknown>;
    const name = str(cu.name, 120);
    const phone = normalizePhone(str(cu.phone, 30));
    const email = str(cu.email, 160).toLowerCase();
    const county = str(cu.county, 60);
    const city = str(cu.city, 100);
    const address = str(cu.address, 240);
    const postCode = str(cu.postCode, 12).replace(/\s+/g, "");
    if (name.length < 2) return fail(400, "bad_customer", "Vă rugăm să introduceți numele complet.");
    if (!phone) return fail(400, "bad_customer", "Vă rugăm să introduceți un număr de telefon mobil valid (ex. 07xx xxx xxx).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "bad_customer", "Vă rugăm să introduceți o adresă de e-mail validă.");
    if (!RO_COUNTIES.includes(county)) return fail(400, "bad_customer", "Vă rugăm să alegeți județul.");
    if (city.length < 2 || address.length < 5) return fail(400, "bad_customer", "Vă rugăm să completați localitatea și adresa de livrare.");
    if (postCode && !/^\d{6}$/.test(postCode)) return fail(400, "bad_customer", "Codul poștal trebuie să aibă 6 cifre.");
    if (cu.termsAccepted !== true) return fail(400, "terms", "Pentru a plasa comanda trebuie să acceptați Termenii și condițiile.");

    const rawItems = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    if (rawItems.length === 0 || rawItems.length > 20) return fail(400, "bad_request", "Coșul este gol.");

    // ── 2. PRICE GUARD + catalog gates (before any side effect) ───────────────
    const overrides = await getPriceOverrides();
    const findProduct = (slug: string) => {
      const p = getProductBySlug(slug);
      return p ? applyOverride(p, overrides) : undefined;
    };

    const lines: { slug: string; sku: string; name: string; quantity: number; ron: number }[] = [];
    for (const it of rawItems) {
      const slug = str(it.slug, 80);
      const product = slug ? findProduct(slug) : undefined;
      if (!product || !roEligible(product)) return fail(409, "not_for_sale", "Unul dintre produse nu este disponibil în această comandă. Vă rugăm să reîncărcați pagina.");
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) return fail(400, "bad_request", "Cantitate invalidă în coș.");
      const unit = Number(it.price);
      if (!Number.isFinite(unit) || unit !== ronOf(product)) {
        console.warn(`[order-ro] price mismatch for ${slug}: client ${String(it.price)}, server ${ronOf(product)}`);
        return fail(409, "price_mismatch", "Prețurile au fost actualizate, vă rugăm să reîncărcați pagina.");
      }
      lines.push({ slug, sku: product.sku, name: product.name, quantity, ron: unit });
    }
    if (new Set(lines.map((l) => l.slug)).size !== lines.length) return fail(400, "bad_request", "Coș invalid. Vă rugăm să reîncărcați pagina.");

    const gate = checkOrderable(lines, findProduct);
    if (!gate.ok) {
      return fail(409, gate.code, gate.code === "not_for_sale"
        ? stockMessage(gate.names.map((n) => ({ name: n, available: 0 })))
        : `${gate.names.join(", ")} nu se poate comanda cu plata la livrare.`);
    }

    const subtotal = roSubtotal(lines);
    const shippingCost = roShippingCost(subtotal);
    const total = roTotal(subtotal);
    const sh = (body.shipping ?? {}) as Record<string, unknown>;
    if (Number(body.subtotal) !== subtotal || Number(sh.cost) !== shippingCost || Number(body.total) !== total) {
      console.warn(`[order-ro] total mismatch: client ${String(body.subtotal)}/${String(sh.cost)}/${String(body.total)}, server ${subtotal}/${shippingCost}/${total}`);
      return fail(409, "price_mismatch", "Prețurile au fost actualizate, vă rugăm să reîncărcați pagina.");
    }

    // ── 3. Idempotency: the same reference is never reserved or inserted twice ─
    const sb = supabaseAdmin();
    const dup = await sb.from("orders").select("id").eq("order_ref", ref).limit(1);
    if (dup.error) { console.error("[order-ro] duplicate check failed:", dup.error.message); return fail(503, "unavailable", "Serviciul este temporar indisponibil. Vă rugăm să reîncercați."); }
    if (dup.data && dup.data.length > 0) return NextResponse.json({ success: true, duplicate: true });

    // ── 4. STOCK GUARD - atomic, all-or-nothing, fail-closed (same function as the Bulgarian order) ──
    const reserveItems = lines.map((l) => ({ slug: l.slug, qty: l.quantity }));
    const { data: res, error: resErr } = await sb.rpc("reserve_wallet_stock", { p_items: reserveItems });
    if (resErr) { console.error("[order-ro] reserve_wallet_stock error:", resErr.message); return fail(503, "unavailable", "A apărut o problemă la verificarea stocului. Vă rugăm să reîncercați."); }
    if (res && (res as { ok?: boolean }).ok === false) {
      const shortfall = ((res as { shortfall?: { slug: string; available: number }[] }).shortfall ?? []).map((s) => ({ name: lines.find((l) => l.slug === s.slug)?.name ?? s.slug, available: s.available }));
      return fail(409, "stock", stockMessage(shortfall));
    }

    // ── 5. Save the order (BEFORE the e-mails). A failed insert gives the stock back and tells the customer. ──
    const orderItems = lines.map((l) => ({ sku: l.sku, slug: l.slug, name: l.name, quantity: l.quantity, qty: l.quantity, price: l.ron, currency: "lei" }));
    const notes = str(cu.notes, 500);
    const { error: insErr } = await sb.from("orders").insert({
      order_ref: ref,
      name,
      phone,
      email,
      city,
      post_code: postCode,
      address: `jud. ${county}, ${address}`,
      shipping_method: "Livrare la domiciliu",
      courier: "ro-curier",
      items: orderItems,
      subtotal,
      shipping_cost: shippingCost,
      total,
      sms_marketing_consent: cu.smsMarketingConsent === true,
      email_marketing_consent: cu.emailMarketingConsent === true,
      notes: notes || null,
      is_international: true,
      ship_country: "RO",
    });
    if (insErr) {
      console.error("[order-ro] insert failed:", insErr.message);
      const { error: restockErr } = await sb.rpc("restock_wallet_stock", { p_items: reserveItems });
      if (restockErr) console.error("[order-ro] restock after failed insert ALSO failed:", restockErr.message, ref);
      return fail(503, "unavailable", "Nu am putut înregistra comanda. Vă rugăm să reîncercați în câteva momente.");
    }

    // ── 6. E-mails + Meta Purchase (awaited: Vercel kills un-awaited work). Best effort: the order is already saved. ──
    const data: RoOrderEmailData = { orderRef: ref, customer: { name, phone, email, county, city, address, postCode, notes }, items: orderItems, subtotal, shippingCost, total };
    const capiCtx = {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      fbc: req.cookies.get("_fbc")?.value,
      fbp: req.cookies.get("_fbp")?.value,
    };
    const results = await Promise.allSettled([
      sendMail({ from: "Lorenzo Ricci Orders <orders@lorenzo-ricci.com>", to: ADMIN_RECIPIENTS, subject: `🇷🇴 Нова поръчка (Румъния) - ${name} - ${ref}`, html: buildRoAdminEmail(data) }),
      sendMail({ from: "Lorenzo Ricci <info@lorenzo-ricci.com>", to: [email], subject: roCustomerSubject, html: buildRoCustomerEmail(data) }),
      sendCapiPurchase({ ...data, skus: lines.map((l) => l.sku) }, capiCtx),
    ]);
    results.forEach((r, i) => { if (r.status === "rejected") console.error(`[order-ro] ${["admin e-mail", "customer e-mail", "CAPI Purchase"][i]} failed:`, r.reason); });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[order-ro] error:", error);
    return fail(500, "error", "A apărut o eroare. Vă rugăm să reîncercați.");
  }
}
