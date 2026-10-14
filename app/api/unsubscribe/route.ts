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

function page(heading: string, text: string, form?: { action: string }, status = 200) {
  const button = form
    ? `<form method="POST" action="${form.action}"><button type="submit">Да, отпиши ме</button></form>`
    : `<p><a href="https://www.lorenzo-ricci.com">Към сайта</a></p>`;
  const html = `<!DOCTYPE html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Lorenzo Ricci</title>
<style>body{margin:0;background:#1a1714;color:#ede6da;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:440px;text-align:center}h1{font-weight:400;font-size:24px;margin:0 0 14px;color:#c9a96e}p{font:15px/1.7 Arial,sans-serif;color:#b8b0a4;margin:0 0 22px}
button{background:#c9a96e;color:#1a1714;border:0;padding:14px 34px;font:12px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}a{color:#c9a96e}</style></head>
<body><main><h1>${heading}</h1><p>${text}</p>${button}</main></body></html>`;
  return new Response(html, { status, headers: HEADERS });
}

const BAD = () => page("Връзката не е валидна", "Тази връзка за отписване е непълна или е била променена. Може да ни пишете на info@lorenzo-ricci.com.", undefined, 400);

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const email = verifyUnsubscribe(p.get("e"), p.get("t"));
  if (!email) return BAD();
  const action = `/api/unsubscribe?e=${encodeURIComponent(p.get("e")!)}&t=${encodeURIComponent(p.get("t")!)}`;
  return page("Отписване от имейлите", "Ще спрем да Ви изпращаме новини и оферти от Lorenzo Ricci. Потвърдете отписването.", { action });
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const email = verifyUnsubscribe(p.get("e"), p.get("t"));
  if (!email) return BAD();

  const { error } = await supabaseAdmin()
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("email", email)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("[Unsubscribe] update failed:", error.message);
    return page("Нещо се обърка", "Не успяхме да запишем отписването. Опитайте отново след малко или ни пишете на info@lorenzo-ricci.com.", undefined, 500);
  }
  // Same answer whether or not the address was on the list — nothing to enumerate.
  return page("Отписахте се", "Няма да получавате повече новини и оферти от Lorenzo Ricci. Поръчките Ви не се влияят.");
}
