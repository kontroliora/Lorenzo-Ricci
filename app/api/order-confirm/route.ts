import { NextResponse, type NextRequest } from "next/server";
import { verifyConfirmToken } from "@/lib/order-confirm-token";
import { confirmByEmail } from "@/lib/confirm-by-email";

// POST only: a mail scanner that opens the link (GET /potvardi/...) never confirms anything; the page posts here.
// JSON body {token} -> JSON outcome. A plain form post (no JavaScript) -> 303 back to the page, which then shows the result.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  let token = "";
  try {
    if (isForm) token = String((await req.formData()).get("token") ?? "");
    else token = String(((await req.json()) as { token?: unknown })?.token ?? "");
  } catch { /* empty body */ }
  const v = verifyConfirmToken(token);
  const out = v.ok ? await confirmByEmail(v.claim) : { kind: v.reason };
  if (isForm) return NextResponse.redirect(new URL(`/potvardi/${encodeURIComponent(token)}`, req.url), 303);
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
