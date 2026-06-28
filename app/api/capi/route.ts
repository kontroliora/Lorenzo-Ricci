import { NextRequest, NextResponse } from "next/server";

const META_PIXEL_ID    = "661480326560209";
const ALLOWED_EVENTS   = new Set(["AddToCart", "InitiateCheckout"]);

type CAPIBody = {
  eventName:   string;
  eventId:     string;
  value?:      number;
  currency?:   string;
  contentIds?: string[];
  numItems?:   number;
};

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false });

  try {
    const body = await req.json() as CAPIBody;

    if (!ALLOWED_EVENTS.has(body.eventName) || !body.eventId) {
      return NextResponse.json({ ok: false, error: "invalid payload" });
    }

    // Extract matching parameters from the incoming browser request
    const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                      ?? req.headers.get("x-real-ip")
                      ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const fbc       = req.cookies.get("_fbc")?.value ?? undefined;
    const fbp       = req.cookies.get("_fbp")?.value ?? undefined;

    const userData: Record<string, unknown> = { country: ["bg"] };
    if (ip)        userData.client_ip_address = ip;
    if (userAgent) userData.client_user_agent = userAgent;
    if (fbc)       userData.fbc = fbc;
    if (fbp)       userData.fbp = fbp;

    const customData: Record<string, unknown> = {
      currency: body.currency ?? "EUR",
    };
    if (body.contentIds?.length) {
      customData.content_ids  = body.contentIds;
      customData.content_type = "product";
    }
    if (body.value    != null) customData.value     = body.value;
    if (body.numItems != null) customData.num_items = body.numItems;

    const payload = {
      data: [{
        event_name:       body.eventName,
        event_time:       Math.floor(Date.now() / 1000),
        event_id:         body.eventId,
        event_source_url: "https://lorenzo-ricci.com",
        action_source:    "website",
        user_data:        userData,
        custom_data:      customData,
      }],
      access_token: token,
    };

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(4000),
      }
    );

    const result = await res.json();
    if (!res.ok) console.error(`[CAPI] ${body.eventName} error:`, result);
    else         console.log(`[CAPI] ${body.eventName} sent (id=${body.eventId}):`, result);

    return NextResponse.json({ ok: res.ok });
  } catch (err) {
    console.error("[CAPI] Unexpected error:", err);
    return NextResponse.json({ ok: false });
  }
}
