// Vercel Cron at 00:01 Sofia time (vercel.json runs it at 21:01 and 22:01 UTC, so it hits midnight in summer and in
// winter time). When a campaign phase starts or ends today (lib/sale-campaign.ts: CAMPAIGN_PHASES), every storefront
// page, Bulgarian and /ro, is rebuilt now: the banner, the red sale badges and /namalenia switch with the date instead
// of waiting for the hourly rebuild. On any other night it does nothing. Vercel injects Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { campaignLabel } from "@/lib/sale-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Fail CLOSED, like the other crons.
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!cronSecret || auth !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const before = campaignLabel(new Date(now.getTime() - 90 * 60_000)); // yesterday evening in Sofia, both runs
  const today = campaignLabel(now);
  if (before === today) return NextResponse.json({ ok: true, switched: false, label: today });

  revalidatePath("/", "layout"); // every page under the root layout: BG and /ro
  console.log("[CampaignPhase]", JSON.stringify({ from: before, to: today }));
  return NextResponse.json({ ok: true, switched: true, from: before, to: today });
}
