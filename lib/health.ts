// Health checks for the panel's top bar + Telegram alerts. Run every 15 min by /api/cron/health (Vercel Cron). Read-only towards
// the shop: it only reads orders / checkout_events / stock, calls Stripe (list events), Econt (a status lookup) and Meta data
// already in the database, and writes health_status. Never touches prices, checkout, stock or orders.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { products } from "@/lib/products";
import { computeAdPerformance, fetchAdMeta, fetchOrders, ZERO_ORDER_SPEND } from "@/lib/ad-performance";
import { periodRange, sofiaHour, sofiaDay } from "@/lib/sofia-time";

const SITE = "https://www.lorenzo-ricci.com";
export const ALERT_EVERY_MS = 60 * 60_000;      // one Telegram message per problem per hour at most

export type Check = { key: string; ok: boolean; title: string; detail?: string; unknown?: boolean };

async function probe(path: string, init?: RequestInit): Promise<{ status: number; ms: number; error?: string }> {
  const t = Date.now();
  try {
    const r = await fetch(`${SITE}${path}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "lr-health/1 (uptime monitor)" }, ...init });
    return { status: r.status, ms: Date.now() - t };
  } catch (e) {
    return { status: 0, ms: Date.now() - t, error: e instanceof Error ? e.name : "error" };
  }
}

// ── 1. Site + checkout up ────────────────────────────────────────────────────
async function checkSite(): Promise<Check[]> {
  const pages = ["/", "/ro", "/products/yachting-black"];
  // The order endpoints answer GET with 405 when they are deployed and alive; 5xx / timeout = the checkout cannot take orders.
  const checkout = ["/api/order", "/api/order-ro"];
  const [p, c] = await Promise.all([Promise.all(pages.map((x) => probe(x))), Promise.all(checkout.map((x) => probe(x)))]);
  const bad = (paths: string[], res: { status: number; error?: string }[]) =>
    paths.map((x, i) => ({ x, r: res[i] })).filter(({ r }) => r.status === 0 || r.status >= 500).map(({ x, r }) => `${x} → ${r.status || r.error}`);
  const badP = bad(pages, p);
  const badC = bad(checkout, c);
  return [
    { key: "site", ok: badP.length === 0, title: "Сайтът не отговаря / 5xx", detail: badP.join(", ") || undefined },
    { key: "checkout", ok: badC.length === 0, title: "Поръчките (checkout) не работят / 5xx", detail: badC.join(", ") || undefined },
  ];
}

// ── 2. Server errors / failed orders / 409 price mismatches (checkout_events) ─
async function checkCheckoutErrors(sb: SupabaseClient): Promise<Check[]> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const q = await sb.from("checkout_events").select("kind, code, status").gte("created_at", since).in("kind", ["server", "network"]).limit(1000);
  if (q.error) return [{ key: "checkout_errors", ok: true, unknown: true, title: "Грешки при поръчка", detail: "checkout_events не може да се прочете" }];
  const rows = q.data ?? [];
  const s5 = rows.filter((r) => r.kind === "server" && Number(r.status) >= 500).length;
  const net = rows.filter((r) => r.kind === "network").length;
  const price = rows.filter((r) => r.kind === "server" && Number(r.status) === 409 && /price|mismatch/i.test(String(r.code ?? ""))).length;
  const other409 = rows.filter((r) => r.kind === "server" && Number(r.status) === 409).length - price;
  return [
    { key: "server_errors", ok: s5 + net < 3, title: "Скок на сървърни грешки при поръчка", detail: `${s5} × 5xx, ${net} × мрежова грешка за последния час` },
    { key: "price_409", ok: price < 3, title: "Много 409 разминаване в цената", detail: `${price} × price_mismatch за последния час` },
    { key: "failed_orders", ok: other409 < 5, title: "Много отказани поръчки (409)", detail: `${other409} × 409 (наличност / промо / продукт) за последния час` },
  ];
}

// ── 3. Stripe webhook deliveries ─────────────────────────────────────────────
async function checkStripe(): Promise<Check> {
  const base = { key: "stripe_webhook", title: "Stripe webhook не се доставя" };
  if (!(process.env.STRIPE_SECRET_KEY ?? "").trim()) return { ...base, ok: true, unknown: true, detail: "няма STRIPE_SECRET_KEY" };
  try {
    const stripe = getStripe();
    const now = Math.floor(Date.now() / 1000);
    // Events of the last 6 hours, older than 10 minutes (Stripe retries within seconds), that are still not delivered.
    const failed = await stripe.events.list({ delivery_success: false, created: { gte: now - 6 * 3600, lte: now - 600 }, limit: 20 });
    const list = failed.data.filter((e) => e.pending_webhooks > 0);
    return { ...base, ok: list.length === 0, detail: list.length ? `${list.length} недоставени: ${list.slice(0, 5).map((e) => e.type).join(", ")}` : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A restricted key without "Events: read" cannot check this: shown as unknown, never as a problem.
    if (/permission|restricted|rak_|does not have/i.test(msg)) return { ...base, ok: true, unknown: true, detail: "ключът няма право Events: read" };
    return { ...base, ok: false, title: "Stripe API не отговаря", detail: msg.slice(0, 160) };
  }
}

// ── 4. Econt API ─────────────────────────────────────────────────────────────
async function checkEcont(): Promise<Check> {
  const base = { key: "econt", title: "Econt API не работи" };
  if (!process.env.ECONT_USER) return { ...base, ok: true, unknown: true, detail: "няма ECONT_USER" };
  try {
    const auth = "Basic " + Buffer.from(`${process.env.ECONT_USER ?? ""}:${process.env.ECONT_PASS ?? ""}`).toString("base64");
    const r = await fetch("https://ee.econt.com/services/Shipments/ShipmentService.getShipmentStatuses.json", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ shipmentNumbers: ["1000000000"] }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 401 || r.status === 403) return { ...base, ok: false, detail: `HTTP ${r.status}: грешно потребителско име / парола` };
    if (r.status >= 500) return { ...base, ok: false, detail: `HTTP ${r.status}` };
    const j = await r.json().catch(() => null);
    return { ...base, ok: !!j && typeof j === "object", detail: j ? undefined : "невалиден отговор" };
  } catch (e) {
    return { ...base, ok: false, detail: e instanceof Error ? `${e.name}: няма отговор за 15 с` : "грешка" };
  }
}

// ── 5. Ads ───────────────────────────────────────────────────────────────────
// Start of the last 6 hours that fall inside 09:00-23:00 Sofia (night hours do not count).
function sixDayHoursAgo(now = new Date()): Date {
  let t = now.getTime(), need = 6 * 60;
  while (need > 0) {
    t -= 15 * 60_000;
    const h = sofiaHour(new Date(t));
    if (h >= 9 && h < 23) need -= 15;
  }
  return new Date(t);
}

async function checkAds(sb: SupabaseClient): Promise<Check[]> {
  const out: Check[] = [];
  const metas = await fetchAdMeta(sb);
  if (!metas.length) return [{ key: "meta_sync", ok: true, unknown: true, title: "Meta данни", detail: "още няма синхронизирани реклами" }];
  const active = metas.filter((m) => m.effective_status === "ACTIVE");

  const r = periodRange("today");
  const perf = await computeAdPerformance(sb, { since: r.sinceDay, until: r.untilDay, startISO: r.startISO, endISO: r.endISO, today: r.untilDay, todayStartISO: r.startISO, market: "all" });

  // Meta data fresh? (synced hourly)
  const ageH = perf.lastSync ? (Date.now() - Date.parse(perf.lastSync)) / 3_600_000 : null;
  out.push({ key: "meta_sync", ok: ageH == null || ageH < 3, title: "Meta данните не се обновяват", detail: ageH == null ? undefined : `последно преди ${ageH.toFixed(1)} ч` });

  // An ad that spent > €15 today with 0 orders - one problem per ad.
  for (const ad of perf.ads) {
    if (ad.todaySpend > ZERO_ORDER_SPEND && ad.todayOrders === 0)
      out.push({ key: `ad_zero:${ad.ad_id}`, ok: false, title: `Реклама „${ad.ad_name}" похарчи €${ad.todaySpend.toFixed(2)} днес, 0 поръчки`, detail: `${ad.campaign_name} · ${ad.market.toUpperCase()}${ad.basis === "meta" ? " · поръчки по Meta (рекламата няма UTM)" : ""}` });
  }

  // Sold-out product with an active ad.
  const soldOut = new Set(products.filter((p) => !p.inStock).map((p) => p.slug));
  const inv = await sb.from("wallet_inventory").select("slug, stock").lte("stock", 0);
  for (const row of inv.data ?? []) if (row?.slug) soldOut.add(String(row.slug));
  for (const ad of active) {
    if (ad.product_slug && soldOut.has(ad.product_slug))
      out.push({ key: `soldout:${ad.ad_id}`, ok: false, title: `Изчерпан продукт с активна реклама: ${products.find((p) => p.slug === ad.product_slug)?.name ?? ad.product_slug}`, detail: `реклама „${ad.ad_name ?? ad.ad_id}" (${ad.campaign_name ?? ""})` });
  }

  // No orders for 6 daytime hours while ads are running (09:00-23:00 Sofia).
  const h = sofiaHour();
  const spendingToday = perf.ads.some((a) => a.todaySpend > 0);
  if (h >= 9 && h < 23 && active.length > 0 && spendingToday) {
    const since = sixDayHoursAgo();
    const orders = await fetchOrders(sb, since.toISOString(), new Date().toISOString());
    out.push({ key: "no_orders_6h", ok: orders.length > 0, title: "Няма поръчки 6 часа, а рекламите вървят", detail: `от ${since.toLocaleTimeString("bg-BG", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit" })} · €${perf.totals.spend.toFixed(2)} разход днес` });
  } else {
    out.push({ key: "no_orders_6h", ok: true, title: "Няма поръчки 6 часа, а рекламите вървят" });
  }
  return out;
}

const safe = async (name: string, fn: () => Promise<Check | Check[]>): Promise<Check[]> => {
  try { const r = await fn(); return Array.isArray(r) ? r : [r]; }
  catch (e) { return [{ key: `check:${name}`, ok: true, unknown: true, title: name, detail: e instanceof Error ? e.message.slice(0, 160) : "грешка" }]; }
};

export async function runChecks(sb: SupabaseClient): Promise<Check[]> {
  const groups = await Promise.all([
    safe("site", checkSite), safe("checkout_errors", () => checkCheckoutErrors(sb)), safe("stripe", checkStripe), safe("econt", checkEcont), safe("ads", () => checkAds(sb)),
  ]);
  return groups.flat();
}

// ── Telegram ─────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chat = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chat) return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: html.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.description ?? `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "error" }; }
}

type Row = { key: string; ok: boolean; title: string; detail: string | null; since: string | null; checked_at: string; last_alerted_at: string | null };

/** Run the checks, store them, send Telegram for problems not alerted in the last hour (+ one "решено" when a problem clears). */
export async function runHealth(sb: SupabaseClient, opts: { extra?: Check[]; source?: string } = {}) {
  const checks = [...(await runChecks(sb)), ...(opts.extra ?? [])];
  const nowISO = new Date().toISOString();
  const prev = await sb.from("health_status").select("key, ok, title, detail, since, checked_at, last_alerted_at");
  if (prev.error) throw new Error(`health_status: ${prev.error.message}`);
  const before = new Map(((prev.data ?? []) as Row[]).map((r) => [r.key, r]));

  const rows: Row[] = [];
  const due: Check[] = [];
  const resolved: Row[] = [];
  const seen = new Set<string>();
  for (const c of checks) {
    seen.add(c.key);
    const b = before.get(c.key);
    const wasBad = b && !b.ok;
    const alertDue = !c.ok && (!b?.last_alerted_at || Date.now() - Date.parse(b.last_alerted_at) >= ALERT_EVERY_MS - 60_000);
    if (alertDue) due.push(c);
    if (c.ok && wasBad && b.last_alerted_at) resolved.push(b);
    rows.push({
      key: c.key, ok: c.ok, title: c.title, detail: c.unknown ? `не е проверено: ${c.detail ?? ""}` : c.detail ?? null,
      since: c.ok ? null : (wasBad ? b!.since : nowISO), checked_at: nowISO,
      last_alerted_at: alertDue ? nowISO : c.ok ? null : b?.last_alerted_at ?? null,
    });
  }
  // Per-ad problems that did not come back this run are over.
  for (const b of before.values()) {
    if (seen.has(b.key) || b.key === "_run" || b.key === "_run_prev") continue;
    if (!b.ok && b.last_alerted_at) resolved.push(b);
    rows.push({ ...b, ok: true, since: null, checked_at: nowISO, last_alerted_at: null });
  }
  // Run history: this run in '_run', the one before in '_run_prev' (detail = short JSON summary), so "the last 2 runs" can be shown.
  const prevRun = before.get("_run");
  if (prevRun) rows.push({ ...prevRun, key: "_run_prev", title: "previous run" });
  const summary = JSON.stringify({ src: opts.source ?? "cron", checks: checks.length, problems: checks.filter((c) => !c.ok).map((c) => c.key) }).slice(0, 900);
  rows.push({ key: "_run", ok: true, title: "last run", detail: summary, since: null, checked_at: nowISO, last_alerted_at: null });

  let telegram: { ok: boolean; error?: string } | null = null;
  if (due.length || resolved.length) {
    const lines: string[] = [];
    if (due.length) {
      lines.push(`🔴 <b>Lorenzo Ricci: ${due.length} ${due.length === 1 ? "проблем" : "проблема"}</b>`);
      for (const c of due) lines.push(`• ${esc(c.title)}${c.detail ? `\n   <i>${esc(c.detail)}</i>` : ""}`);
    }
    if (resolved.length) {
      if (lines.length) lines.push("");
      lines.push(`✅ <b>Решено</b>`);
      for (const r of resolved) lines.push(`• ${esc(r.title)}`);
    }
    lines.push(`\n${SITE}/lr-panel-v8m3q/orders`);
    telegram = await sendTelegram(lines.join("\n"));
    if (!telegram.ok) for (const r of rows) if (due.some((d) => d.key === r.key)) r.last_alerted_at = before.get(r.key)?.last_alerted_at ?? null; // retry next run
  }

  const up = await sb.from("health_status").upsert(rows, { onConflict: "key" });
  if (up.error) throw new Error(`health_status upsert: ${up.error.message}`);
  // Cleared per-ad rows are dropped so the table stays small.
  await sb.from("health_status").delete().eq("ok", true).or("key.like.ad_zero:*,key.like.soldout:*,key.like.check:*,key.like.test:*");

  return { checks: checks.length, problems: checks.filter((c) => !c.ok).map((c) => c.key), alerted: due.map((c) => c.key), resolved: resolved.map((r) => r.key), telegram, day: sofiaDay() };
}
