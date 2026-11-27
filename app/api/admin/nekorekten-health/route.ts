import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/supabase/admin-db";
import { proxiedFetch, proxyDispatcher, proxyHost, nekorektenConfigured, failKindOfStatus, FAIL_LABEL } from "@/lib/nekorekten";

// "Тест връзка" (owner only, 28.11.2026): which IP do our Nekorekten calls leave from, and does Nekorekten.com accept it?
// READ-ONLY: the IP probe (api.ipify.org) and GET /api/v1/api-keys/current/usage (documented, uses no search and sends no report).
// Both go through the SAME proxy agent as the real calls (lib/nekorekten.ts). The key and the proxy password never leave the server.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, private" };

export async function GET() {
  const me = await getAdminSession().catch(() => null);
  if (me?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });

  const proxied = !!proxyDispatcher();
  const out: Record<string, unknown> = { at: new Date().toISOString(), proxy: proxied ? proxyHost() : null, keyConfigured: nekorektenConfigured() };

  // 1. outgoing IP through the proxy
  {
    const t0 = Date.now();
    try {
      const r = await proxiedFetch("https://api.ipify.org?format=json", { headers: { Accept: "application/json" } });
      const j = (await r.json().catch(() => null)) as { ip?: string } | null;
      out.egress = { ok: r.ok, status: r.status, ip: j?.ip ?? null, ms: Date.now() - t0 };
    } catch (e) {
      out.egress = { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t0 };
    }
  }

  // 2. one read-only request to Nekorekten.com
  if (!nekorektenConfigured()) {
    out.nekorekten = { ok: false, kind: "key", label: "липсва NEKOREKTEN_API_KEY" };
  } else {
    const t0 = Date.now();
    try {
      const r = await proxiedFetch("https://api.nekorekten.com/api/v1/api-keys/current/usage", {
        headers: { "Api-Key": (process.env.NEKOREKTEN_API_KEY ?? "").trim(), Accept: "application/json" },
      });
      const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      const kind = r.ok ? null : failKindOfStatus(r.status);
      out.nekorekten = {
        ok: r.ok, status: r.status, ms: Date.now() - t0,
        label: r.ok ? "OK" : FAIL_LABEL[kind!], message: typeof j?.message === "string" ? j.message : null,
        usage: r.ok ? j : null,   // the key's plan limits / usage (no personal data)
      };
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      out.nekorekten = { ok: false, kind: "down", label: FAIL_LABEL.down, error: name === "TimeoutError" ? "няма отговор за 8 s" : e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
  }
  console.log("[nekorekten-health]", JSON.stringify({ proxy: out.proxy, egress: out.egress, nekorekten: { ...(out.nekorekten as object), usage: undefined } }));
  return NextResponse.json(out, { headers: noStore });
}
