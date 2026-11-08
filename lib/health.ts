// Health checks for the panel's top bar + Telegram alerts. Run every 15 min by /api/cron/health (Vercel Cron). Read-only towards
// the shop: it only reads orders / checkout_events / stock, calls Stripe (list events), Econt (a status lookup) and Meta data
// already in the database, and writes health_status. Never touches prices, checkout, stock or orders.
import { RO_STORE_ENABLED } from "@/lib/ro-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { products } from "@/lib/products";
import { computeAdPerformance, fetchAdMeta, fetchOrders, RULE_DAYS } from "@/lib/ad-performance";
import { periodRange, sofiaHour, sofiaDay } from "@/lib/sofia-time";
import { imageUrl } from "@/lib/image-loader";
import IMAGE_WIDTHS from "@/lib/image-widths.json";

const SITE = "https://www.lorenzo-ricci.com";
export const ALERT_EVERY_MS = 60 * 60_000;      // one Telegram message per problem per hour at most

export type Check = { key: string; ok: boolean; title: string; detail?: string; unknown?: boolean };
/** A check that did not run this time (it runs less often than every 15 min): its last stored state is kept as it is. */
export type Skip = { skip: string };
type Out = Check | Skip;
const isSkip = (x: Out): x is Skip => "skip" in x;

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
  const pages = ["/", ...(RO_STORE_ENABLED ? ["/ro"] : []), "/products/yachting-black"]; // RO only while the store is on (lib/ro-store.ts)
  // The order endpoints answer GET with 405 when they are deployed and alive; 5xx / timeout = the checkout cannot take orders.
  const checkout = ["/api/order", ...(RO_STORE_ENABLED ? ["/api/order-ro"] : [])];
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

  // The playbook rule (lib/ad-performance.ts, 3-day view): an active ad, 3+ days old, with €50+ and 0 orders or > €35 per order
  // over the last 3 days - one problem per ad. The ROAS tab paints the same ads red.
  for (const ad of perf.ads) {
    if (ad.red.length && ad.status === "ACTIVE")
      out.push({ key: `ad_rule:${ad.ad_id}`, ok: false, title: `Реклама „${ad.ad_name}": ${ad.red.join(" · ")}`, detail: `${ad.campaign_name} · ${ad.market.toUpperCase()} · €${ad.spend3.toFixed(2)} / ${ad.orders3} поръчки за ${RULE_DAYS} дни${ad.basis === "meta" ? " · поръчки по Meta (рекламата няма UTM)" : ""}` });
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

// ── 6. Browser JS errors (client_errors, written by /api/client-error) ──────
// Same error 5+ times in the last hour -> problem; ANY error while the cart / checkout is open -> problem. Rows older than 14 days
// are deleted here (once an hour).
const CLIENT_ERR_REPEAT = 5;
const CLIENT_ERR_KEEP_DAYS = 14;
async function checkClientErrors(sb: SupabaseClient): Promise<Check[]> {
  if (new Date().getUTCMinutes() < 15)
    await sb.from("client_errors").delete().lt("created_at", new Date(Date.now() - CLIENT_ERR_KEEP_DAYS * 86_400_000).toISOString());
  const q = await sb.from("client_errors").select("sig, message, page, area, market, browser, weight").gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString()).limit(2000);
  if (q.error) return [{ key: "client_errors", ok: true, unknown: true, title: "JS грешки в браузъра", detail: "client_errors няма (supabase/monitoring_v2.sql)" }];
  type G = { n: number; message: string; pages: Set<string>; browsers: Set<string>; checkout: boolean; markets: Set<string> };
  const by = new Map<string, G>();
  for (const r of q.data ?? []) {
    const g = by.get(r.sig) ?? { n: 0, message: r.message, pages: new Set(), browsers: new Set(), checkout: false, markets: new Set() };
    g.n += Number(r.weight) || 1; g.pages.add(r.page); if (r.browser) g.browsers.add(r.browser); g.markets.add(r.market);
    if (r.area === "cart" || r.area === "checkout") g.checkout = true;
    by.set(r.sig, g);
  }
  const out: Check[] = [{ key: "client_errors", ok: true, title: "JS грешки в браузъра", detail: `${[...by.values()].reduce((s, g) => s + g.n, 0)} за последния час` }];
  for (const [sig, g] of by) {
    const detail = `${g.n}× за час · ${[...g.markets].join("/").toUpperCase()} · ${[...g.pages].slice(0, 3).join(", ")} · ${[...g.browsers].slice(0, 3).join(", ")}`;
    if (g.checkout) out.push({ key: `cerr_co:${sig}`, ok: false, title: `JS грешка в количката / поръчката: ${g.message.slice(0, 140)}`, detail });
    else if (g.n >= CLIENT_ERR_REPEAT) out.push({ key: `cerr:${sig}`, ok: false, title: `JS грешка ${g.n}× за час: ${g.message.slice(0, 140)}`, detail });
  }
  return out;
}

// ── 7. Product images (404) ──────────────────────────────────────────────────
// HEAD of every product photo (cover, hover, gallery) and its 800 px copy. Runs after each new deployment and otherwise every
// 6 hours (~500 HEAD requests to static files, no function runs); the time + deployment of the last run are in '_img_check'.
const IMG_EVERY_MS = 6 * 3600_000;
export async function checkImages(sb: SupabaseClient): Promise<Out> {
  const deploy = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const last = (await sb.from("health_status").select("detail, checked_at").eq("key", "_img_check").maybeSingle()).data;
  if (last && last.detail === deploy && Date.now() - Date.parse(last.checked_at) < IMG_EVERY_MS) return { skip: "product_images" };
  const paths = new Set<string>();
  for (const p of products) {
    const q = p as unknown as { coverImage?: { src?: string }; hoverImage?: { src?: string }; images?: { src?: string }[] };
    for (const src of [q.coverImage?.src, q.hoverImage?.src, ...(q.images ?? []).map((i) => i.src)]) {
      if (!src || !src.startsWith("/")) continue;
      paths.add(src);
      paths.add(decodeURI(imageUrl(src, IMAGE_WIDTHS.widths[1]).split("?")[0])); // one of its resized copies (lib/image-loader.ts): a photo whose copies were never made shows up
    }
  }
  const list = [...paths];
  const broken: string[] = [];
  let failed = 0;
  for (let i = 0; i < list.length; i += 20) {
    const res = await Promise.all(list.slice(i, i + 20).map((x) => probe(encodeURI(x), { method: "HEAD" })));
    res.forEach((r, j) => { if (r.status === 404) broken.push(list[i + j]); else if (r.status === 0 || r.status >= 500) failed++; });
  }
  await sb.from("health_status").upsert({ key: "_img_check", ok: true, title: "image check", detail: deploy, checked_at: new Date().toISOString() }, { onConflict: "key" });
  return {
    key: "product_images", ok: broken.length === 0, title: `Липсващи снимки на продукти (404): ${broken.length}`,
    detail: broken.length ? broken.slice(0, 6).map((x) => x.split("/").slice(-2).join("/")).join(", ") + (broken.length > 6 ? ` … +${broken.length - 6}` : "")
      : `${list.length} снимки проверени${failed ? `, ${failed} без отговор` : ""}`,
  };
}

// ── 8. Synthetic shopper (every 30 min, plain HTTP, nothing is submitted) ───
// BG and RO: home -> a product page -> "add to cart" (the stock call the product page makes before the button is enabled) ->
// "open checkout" (the Econt office list the checkout form loads + the order endpoint answers). A failed step is retried once.
const BG_ADD = /Добави в количката|Добави в кошницата|Купи/;
export async function checkSynthetic(): Promise<Out> {
  if (new Date().getUTCMinutes() % 30 >= 15) return { skip: "synthetic" };
  const get = async (path: string) => {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(`${SITE}${path}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "lr-health/1 (synthetic check)" } });
        const body = await r.text();
        if (r.status < 500 || i === 1) return { status: r.status, body };
      } catch (e) { if (i === 1) return { status: 0, body: "", error: e instanceof Error ? e.name : "error" }; }
    }
    return { status: 0, body: "" };
  };
  const steps: string[] = [];
  const fail = (step: string, why: string) => steps.push(`${step}: ${why}`);
  const sellable = products.filter((p) => p.inStock);
  const pick = (html: string, re: RegExp) => {
    const seen = new Set([...html.matchAll(re)].map((m) => m[1]));
    return sellable.find((p) => seen.has(p.slug)) ?? sellable[0];
  };

  // BG
  const home = await get("/");
  if (home.status !== 200 || !/lorenzo/i.test(home.body)) fail("BG начало", `HTTP ${home.status || home.error}`);
  const bgProduct = pick(home.body, /href="\/products\/([a-z0-9-]+)"/g);
  if (!bgProduct) fail("BG продукт", "няма продукт в наличност");
  else {
    const page = await get(`/products/${bgProduct.slug}`);
    if (page.status !== 200) fail(`BG продукт ${bgProduct.slug}`, `HTTP ${page.status || page.error}`);
    else if (!page.body.includes(bgProduct.name) && !BG_ADD.test(page.body)) fail(`BG продукт ${bgProduct.slug}`, "страницата е празна");
    const stock = await get(`/api/stock/${bgProduct.slug}`);
    let ok = stock.status === 200;
    try { ok = ok && "stock" in JSON.parse(stock.body); } catch { ok = false; }
    if (!ok) fail("BG добави в количката (наличност)", `HTTP ${stock.status || stock.error}`);
  }
  const offices = await get("/api/econt/offices");
  let officesOk = offices.status === 200;
  try { officesOk = officesOk && (JSON.parse(offices.body).offices?.length ?? 0) > 0; } catch { officesOk = false; }
  if (!officesOk) fail("BG checkout (офиси на Еконт)", `HTTP ${offices.status || offices.error}`);
  const order = await get("/api/order");
  if (order.status === 0 || order.status >= 500) fail("BG checkout (/api/order)", `HTTP ${order.status || order.error}`);

  // RO (skipped while the Romanian store is off: lib/ro-store.ts)
  if (!RO_STORE_ENABLED) return { key: "synthetic", ok: steps.length === 0, title: "Тестов купувач: стъпка се проваля (начало → продукт → количка → поръчка)", detail: steps.join(" · ") || undefined };
  const roHome = await get("/ro");
  if (roHome.status !== 200) fail("RO начало", `HTTP ${roHome.status || roHome.error}`);
  const roProduct = pick(roHome.body, /href="\/ro\/produse\/([a-z0-9-]+)"/g);
  if (roProduct) {
    const page = await get(`/ro/produse/${roProduct.slug}`);
    if (page.status !== 200) fail(`RO produs ${roProduct.slug}`, `HTTP ${page.status || page.error}`);
  }
  const roOrder = await get("/api/order-ro");
  if (roOrder.status === 0 || roOrder.status >= 500) fail("RO checkout (/api/order-ro)", `HTTP ${roOrder.status || roOrder.error}`);

  return { key: "synthetic", ok: steps.length === 0, title: "Тестов купувач: стъпка се проваля (начало → продукт → количка → поръчка)", detail: steps.join(" · ") || undefined };
}

// ── 9. Resend: bounced / failed / spam e-mails (email_events, via /api/resend-webhook) + the API key itself ─────────────
async function checkEmail(sb: SupabaseClient): Promise<Out[]> {
  const out: Out[] = [];
  const q = await sb.from("email_events").select("type, recipient, subject, reason").gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString()).limit(200);
  if (q.error) out.push({ key: "email_failures", ok: true, unknown: true, title: "Имейли: отскочили / неуспешни", detail: "email_events няма (supabase/monitoring_v2.sql)" });
  else if (!(process.env.RESEND_WEBHOOK_SECRET ?? "").trim()) out.push({ key: "email_failures", ok: true, unknown: true, title: "Имейли: отскочили / неуспешни", detail: "няма RESEND_WEBHOOK_SECRET (webhook в Resend)" });
  else {
    const rows = q.data ?? [];
    const bad = rows.filter((r) => r.type !== "email.delivery_delayed");
    const delayed = rows.length - bad.length;
    const label: Record<string, string> = { "email.bounced": "отскочил", "email.failed": "неуспешен", "email.complained": "маркиран като спам" };
    out.push({
      key: "email_failures", ok: bad.length === 0 && delayed < 5, title: `Имейли с проблем за последния час: ${bad.length}${delayed ? ` (+${delayed} забавени)` : ""}`,
      detail: bad.slice(0, 4).map((r) => `${label[r.type] ?? r.type}: ${r.recipient ?? "?"} · ${r.subject ?? ""}${r.reason ? ` (${r.reason})` : ""}`).join("; ") || undefined,
    });
  }
  // The key and the sending domain, once an hour.
  if (new Date().getUTCMinutes() >= 15) { out.push({ skip: "resend_api" }); return out; }
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  const base = { key: "resend_api", title: "Resend (имейли) не работи" };
  if (!key) { out.push({ ...base, ok: true, unknown: true, detail: "няма RESEND_API_KEY" }); return out; }
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const j = (await r.json().catch(() => ({}))) as { data?: { name: string; status: string }[]; name?: string; message?: string };
    if (r.status === 401 && /restricted/i.test(`${j.name} ${j.message}`)) out.push({ ...base, ok: true, unknown: true, detail: "ключът е само за изпращане: домейнът не се проверява" });
    else if (r.status === 401 || r.status === 403) out.push({ ...base, ok: false, detail: `ключът е отказан (HTTP ${r.status}): ${j.message ?? ""}`.slice(0, 160) });
    else if (r.status >= 500 || !r.ok) out.push({ ...base, ok: false, detail: `HTTP ${r.status}` });
    else {
      const notOk = (j.data ?? []).filter((d) => d.status !== "verified");
      out.push({ ...base, ok: notOk.length === 0, title: notOk.length ? "Домейнът за имейли в Resend не е потвърден" : base.title, detail: notOk.map((d) => `${d.name}: ${d.status}`).join(", ") || undefined });
    }
  } catch (e) { out.push({ ...base, ok: false, detail: e instanceof Error ? `${e.name}: няма отговор` : "грешка" }); }
  return out;
}

const safe = async (name: string, fn: () => Promise<Out | Out[]>): Promise<Out[]> => {
  try { const r = await fn(); return Array.isArray(r) ? r : [r]; }
  catch (e) { return [{ key: `check:${name}`, ok: true, unknown: true, title: name, detail: e instanceof Error ? e.message.slice(0, 160) : "грешка" }]; }
};

export async function runChecks(sb: SupabaseClient): Promise<{ checks: Check[]; keep: Set<string> }> {
  const groups = await Promise.all([
    safe("site", checkSite), safe("checkout_errors", () => checkCheckoutErrors(sb)), safe("stripe", checkStripe), safe("econt", checkEcont), safe("ads", () => checkAds(sb)),
    safe("client_errors", () => checkClientErrors(sb)), safe("images", () => checkImages(sb)), safe("synthetic", checkSynthetic), safe("email", () => checkEmail(sb)),
  ]);
  const all = groups.flat();
  return { checks: all.filter((x): x is Check => !isSkip(x)), keep: new Set(all.filter(isSkip).map((x) => x.skip)) };
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
  const ran = await runChecks(sb);
  const checks = [...ran.checks, ...(opts.extra ?? [])];
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
    // Skipped this run (runs less often) or an internal marker ('_run', '_img_check', '_meta_backfill'): left exactly as stored.
    if (seen.has(b.key) || ran.keep.has(b.key) || b.key.startsWith("_")) continue;
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
  await sb.from("health_status").delete().eq("ok", true).or("key.like.ad_zero:*,key.like.ad_rule:*,key.like.cerr:*,key.like.cerr_co:*,key.like.soldout:*,key.like.check:*,key.like.test:*");

  return { checks: checks.length, problems: checks.filter((c) => !c.ok).map((c) => c.key), alerted: due.map((c) => c.key), resolved: resolved.map((r) => r.key), telegram, day: sofiaDay() };
}
