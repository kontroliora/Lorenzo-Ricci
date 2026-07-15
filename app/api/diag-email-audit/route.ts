import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY — GDPR audit of where customer emails live and how they split by
// consent basis. Returns COUNTS ONLY, never actual emails. Token-guarded; remove.
const TOKEN = "em4dit9x";
const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isEmail = (e: string) => e.includes("@");

type OrderRow = { email: string | null; email_marketing_consent: boolean | null; excluded_from_stock: boolean };
type NlRow = { email: string | null };
type CartRow = { email: string | null; phone: string | null; recovery_consent: boolean | null; status: string };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("k") !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [od, nl, cs] = await Promise.all([
    sb.from("orders").select("email, email_marketing_consent, excluded_from_stock"),
    sb.from("newsletter_subscribers").select("email"),
    sb.from("cart_sessions").select("email, phone, recovery_consent, status"),
  ]);

  // ── Orders (transactional) ──
  const orders = ((od.data ?? []) as OrderRow[]).filter((r) => !r.excluded_from_stock && isEmail(norm(r.email)));
  const orderEmails = new Set(orders.map((r) => norm(r.email)));
  const orderConsentTrue = new Set(orders.filter((r) => r.email_marketing_consent === true).map((r) => norm(r.email)));

  // ── Newsletter (marketing consent via active subscribe) ──
  const nlEmails = new Set(((nl.data ?? []) as NlRow[]).map((r) => norm(r.email)).filter(isEmail));

  // ── Cart sessions (captured on typing, no submit) ──
  const cart = (cs.data ?? []) as CartRow[];
  const cartWithEmail = cart.filter((r) => isEmail(norm(r.email)));
  const cartEmails = new Set(cartWithEmail.map((r) => norm(r.email)));
  const byStatus: Record<string, number> = {};
  for (const r of cart) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const emailedSet = new Set(cartWithEmail.filter((r) => r.status === "emailed").map((r) => norm(r.email)));

  // ── Overlaps by distinct email ──
  const cartAlsoOrdered = [...cartEmails].filter((e) => orderEmails.has(e));
  const cartNeverOrdered = [...cartEmails].filter((e) => !orderEmails.has(e));
  const cartPureNoConsent = cartNeverOrdered.filter((e) => !nlEmails.has(e)); // never ordered, never subscribed
  const pureNoConsentAlreadyEmailed = cartPureNoConsent.filter((e) => emailedSet.has(e)).length;

  return NextResponse.json({
    ordersTransactional: {
      rows: orders.length,
      distinctEmails: orderEmails.size,
      withMarketingConsentTrue: orderConsentTrue.size,
      note: "email_marketing_consent stored per order; default checkbox is PRE-CHECKED",
    },
    newsletterMarketingConsent: {
      distinctEmails: nlEmails.size,
      note: "active subscribe for -10% code",
    },
    cartSessionsCapturedOnInput: {
      totalRows: cart.length,
      withEmail: cartWithEmail.length,
      distinctEmails: cartEmails.size,
      phoneOnly: cart.length - cartWithEmail.length,
      recoveryConsentTrue: cartWithEmail.filter((r) => r.recovery_consent === true).length,
      recoveryConsentFalse: cartWithEmail.filter((r) => r.recovery_consent === false).length,
      byStatus,
    },
    crossReference: {
      cartEmailsAlsoInOrders: cartAlsoOrdered.length,
      cartCapturedButNeverOrdered: cartNeverOrdered.length,
      PURE_NO_CONSENT_neverOrderedNeverSubscribed: cartPureNoConsent.length,
      ofThose_alreadySentAbandonedCartEmail: pureNoConsentAlreadyEmailed,
    },
    errors: { orders: od.error?.message ?? null, newsletter: nl.error?.message ?? null, cart: cs.error?.message ?? null },
  });
}
