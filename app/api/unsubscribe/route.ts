import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyUnsubscribe } from "@/lib/unsubscribe-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Newsletter unsubscribe. The link in every campaign email is signed (lib/unsubscribe-token.ts).
//   GET  → a confirmation page with one button (a GET never changes anything, so mail scanners that
//          pre-fetch links can't unsubscribe people by accident);
//   POST → marks newsletter_subscribers.unsubscribed_at. Used by that button AND by mail clients'
//          one-click unsubscribe (List-Unsubscribe-Post, RFC 8058), which POST to the same URL.
// Needs supabase/newsletter_unsubscribe.sql (adds the column) to have been run.

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

// The page is Bulgarian, or Romanian for Romanian subscribers: the link may carry l=ro (campaign sender for the Romanian
// market), else the visitor's own language cookie (lr_lang, set by the BG/RO switch) decides. Only the wording changes; the
// signed token still covers the e-mail address alone.
type Lang = "bg" | "ro";
const TEXT = {
  bg: {
    site: "https://www.lorenzo-ricci.com", toSite: "Към сайта", yes: "Да, отпиши ме",
    badTitle: "Връзката не е валидна", badText: "Тази връзка за отписване е непълна или е била променена. Може да ни пишете на info@lorenzo-ricci.com.",
    askTitle: "Отписване от имейлите", askText: "Ще спрем да Ви изпращаме новини и оферти от Lorenzo Ricci. Потвърдете отписването.",
    errTitle: "Нещо се обърка", errText: "Не успяхме да запишем отписването. Опитайте отново след малко или ни пишете на info@lorenzo-ricci.com.",
    doneTitle: "Отписахте се", doneText: "Няма да получавате повече новини и оферти от Lorenzo Ricci. Поръчките Ви не се влияят.",
  },
  ro: {
    site: "https://www.lorenzo-ricci.com/ro", toSite: "Înapoi la site", yes: "Da, dezabonați-mă",
    badTitle: "Linkul nu este valid", badText: "Acest link de dezabonare este incomplet sau a fost modificat. Ne puteți scrie la info@lorenzo-ricci.com.",
    askTitle: "Dezabonare de la e-mailuri", askText: "Nu vă vom mai trimite noutăți și oferte de la Lorenzo Ricci. Vă rugăm să confirmați dezabonarea.",
    errTitle: "Ceva nu a funcționat", errText: "Nu am putut înregistra dezabonarea. Încercați din nou peste puțin timp sau scrieți-ne la info@lorenzo-ricci.com.",
    doneTitle: "Dezabonare confirmată", doneText: "Nu veți mai primi noutăți și oferte de la Lorenzo Ricci. Comenzile dumneavoastră nu sunt afectate.",
  },
} as const;
const langOf = (req: NextRequest): Lang =>
  req.nextUrl.searchParams.get("l") === "ro" || req.cookies.get("lr_lang")?.value === "ro" ? "ro" : "bg";

function page(lang: Lang, heading: string, text: string, form?: { action: string }, status = 200) {
  const t = TEXT[lang];
  const button = form
    ? `<form method="POST" action="${form.action}"><button type="submit">${t.yes}</button></form>`
    : `<p><a href="${t.site}">${t.toSite}</a></p>`;
  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Lorenzo Ricci</title>
<style>body{margin:0;background:#1a1714;color:#ede6da;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:440px;text-align:center}h1{font-weight:400;font-size:24px;margin:0 0 14px;color:#c9a96e}p{font:15px/1.7 Arial,sans-serif;color:#b8b0a4;margin:0 0 22px}
button{background:#c9a96e;color:#1a1714;border:0;padding:14px 34px;font:12px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}a{color:#c9a96e}</style></head>
<body><main><h1>${heading}</h1><p>${text}</p>${button}</main></body></html>`;
  return new Response(html, { status, headers: HEADERS });
}

const BAD = (lang: Lang) => page(lang, TEXT[lang].badTitle, TEXT[lang].badText, undefined, 400);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lang = langOf(req);
  const email = verifyUnsubscribe(p.get("e"), p.get("t"));
  if (!email) return BAD(lang);
  const action = `/api/unsubscribe?e=${encodeURIComponent(p.get("e")!)}&t=${encodeURIComponent(p.get("t")!)}${lang === "ro" ? "&l=ro" : ""}`;
  return page(lang, TEXT[lang].askTitle, TEXT[lang].askText, { action });
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lang = langOf(req);
  const email = verifyUnsubscribe(p.get("e"), p.get("t"));
  if (!email) return BAD(lang);

  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: now })
    .eq("email", email)
    .is("unsubscribed_at", null)
    .select("id");
  // Customers who ticked e-mail marketing at checkout are mailed without being in newsletter_subscribers. Nothing to update for
  // them, so record the opt-out as a row of its own (code_used = true: the placeholder promo code can never be redeemed). Without
  // this their unsubscribe would be a silent no-op and getSuppressedEmails() would never see it.
  if (!error && !updated?.length) {
    const { data: exists } = await sb.from("newsletter_subscribers").select("id").eq("email", email).limit(1);
    if (!exists?.length) {
      const { error: insErr } = await sb.from("newsletter_subscribers").insert({
        email, promo_code: `UNSUB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, code_used: true, unsubscribed_at: now,
      });
      if (insErr) {
        console.error("[Unsubscribe] insert failed:", insErr.message);
        return page(lang, TEXT[lang].errTitle, TEXT[lang].errText, undefined, 500);
      }
    }
  }
  if (error) {
    console.error("[Unsubscribe] update failed:", error.message);
    return page(lang, TEXT[lang].errTitle, TEXT[lang].errText, undefined, 500);
  }
  // Same answer whether or not the address was on the list — nothing to enumerate.
  return page(lang, TEXT[lang].doneTitle, TEXT[lang].doneText);
}
