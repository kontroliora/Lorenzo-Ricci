import { NextRequest, NextResponse } from "next/server";
import { isPreviewDeploy } from "@/lib/deploy-env";
import { isSha256Hex } from "@/lib/match-keys";
import { buildUserData, eventSourceUrl, sendCapiEvents, testEventCode } from "@/lib/meta-capi";

// Server copies of the browser's AddToCart / InitiateCheckout. The browser sends the SAME eventId to the pixel, so Meta counts each
// event once. PageView / ViewContent stay browser-only in production (they carry no event id and would count twice); they are only
// accepted while META_CAPI_TEST_EVENT_CODE is set, so every event type can be checked in Events Manager -> Test events.
const LIVE_EVENTS = new Set(["AddToCart", "InitiateCheckout"]);
const TEST_ONLY_EVENTS = new Set(["PageView", "ViewContent"]);

type CAPIBody = {
  eventName:   string;
  eventId:     string;
  value?:      number;
  currency?:   string;
  contentIds?: string[];
  numItems?:   number;
  /** window.location.href of the page the event happened on */
  url?:        string;
  /** SHA-256 hex of the normalised e-mail / phone (359... / 40...), only when the visitor typed them earlier in this browser */
  em?:         string;
  ph?:         string;
};

export async function POST(req: NextRequest) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return NextResponse.json({ ok: false });
  const test = testEventCode();
  if (isPreviewDeploy() && !test) return NextResponse.json({ ok: false, skipped: "preview" }); // previews share the live token: no live events

  try {
    const body = await req.json() as CAPIBody;

    const allowed = LIVE_EVENTS.has(body.eventName) || (Boolean(test) && TEST_ONLY_EVENTS.has(body.eventName));
    if (!allowed || !body.eventId) {
      return NextResponse.json({ ok: false, error: "invalid payload" });
    }

    // Matching parameters from the incoming browser request
    const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                      ?? req.headers.get("x-real-ip")
                      ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const fbc       = req.cookies.get("_fbc")?.value ?? undefined;
    const fbp       = req.cookies.get("_fbp")?.value ?? undefined;
    const externalId = req.cookies.get("lr_xid")?.value ?? undefined;

    // Romanian market: its events are sent in RON and must say so to Meta.
    const isRo = body.currency === "RON";
    const userData = buildUserData(isRo ? "ro" : "bg",
      { ip, userAgent, fbc, fbp, externalId },
      { emHash: isSha256Hex(body.em) ? body.em : undefined, phHash: isSha256Hex(body.ph) ? body.ph : undefined });

    const customData: Record<string, unknown> = {
      // ISO 4217 only: a display symbol ("€") would make Meta drop the value.
      currency: typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "EUR",
    };
    const ids = Array.isArray(body.contentIds) ? body.contentIds.filter((x) => typeof x === "string" && x.length <= 100).slice(0, 50) : [];
    if (ids.length) {
      customData.content_ids  = ids;
      customData.content_type = "product";
    }
    if (isRo) customData.content_category = "RO";
    if (typeof body.value === "number" && Number.isFinite(body.value)) customData.value = body.value;
    if (typeof body.numItems === "number" && Number.isFinite(body.numItems)) customData.num_items = body.numItems;

    const result = await sendCapiEvents([{
      event_name:       body.eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         String(body.eventId).slice(0, 100),
      // the page the event happened on (own https pages only; the apex host is written as www)
      event_source_url: eventSourceUrl(body.url ?? req.headers.get("referer"), isRo ? "/ro" : "/"),
      action_source:    "website",
      user_data:        userData,
      custom_data:      customData,
    }], 4000);

    if (!result.ok) console.error(`[CAPI] ${body.eventName} error:`, result.body);
    else            console.log(`[CAPI] ${body.eventName} sent (id=${body.eventId}):`, result.body);

    // In test mode the response carries what was sent (without the token) and Meta's answer, for verification.
    return NextResponse.json(test ? { ok: result.ok, test: true, status: result.status, meta: result.body, sent: result.payload } : { ok: result.ok });
  } catch (err) {
    console.error("[CAPI] Unexpected error:", err);
    return NextResponse.json({ ok: false });
  }
}
