// Server side of lib/hero-source.ts: the word lists, the landing-page patterns and the Meta ad map, built when the home page renders
// (it is rebuilt hourly, so a new ad is known within the hour; until then its names and landing page still place it).
import { getProductBySlug, products } from "./products";
import { supabaseAdmin } from "./supabase-admin";
import type { HeroSlideKey, HeroSourceCfg } from "./hero-source";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const slugsOf = (cat: string) => products.filter((p) => p.category === cat).map((p) => esc(p.slug));

// Jewellery words: generic ones + every design name of the jewellery (verdis, noctis, lumen, ..., aurelius, diamante, ...).
const designs = [...new Set(products.filter((p) => p.category === "jewellery").flatMap((p) => p.slug.split("-"))
  .filter((w) => w.length > 3 && !/^(necklace|bracelet|gold|silver|black|white|cross|kolie|grivna)$/.test(w)))];
const JEWEL_WORDS = ["jewel", "bijut", "бижу", "collection", "kolekc", "колекц", "damsk", "дамск", "women", "woman", "zhensk", "женск",
  "necklace", "kolie", "колие", "bracelet", "grivn", "гривн", "clover", "detelin", "детелин", ...designs.map(esc)];
const WATCH_WORDS = ["watch", "chasovn", "часовн", "chrono", "хроно", "hronograf", "yachting", "eclipse", "polar", "ceas"];

const JEWEL_PATH = `^/(jewellery|ro/bijuterii)(/|$)|^/(products|ro/produse)/(${slugsOf("jewellery").join("|")})(/|$)`;
const WATCH_PATH = `^/(watches|ro/ceasuri)(/|$)|^/(products|ro/produse)/(${slugsOf("watches").join("|")})(/|$)`;

function kindOf(row: { product_slug: string | null; landing_url: string | null; ad_name: string | null; adset_name: string | null; campaign_name: string | null }): "jewel" | "watch" | null {
  const cat = row.product_slug ? getProductBySlug(row.product_slug)?.category : undefined;
  if (cat === "jewellery") return "jewel";
  if (cat === "watches") return "watch";
  if (row.landing_url) {
    try {
      const path = new URL(row.landing_url, "https://www.lorenzo-ricci.com").pathname.toLowerCase();
      if (new RegExp(JEWEL_PATH).test(path)) return "jewel";
      if (new RegExp(WATCH_PATH).test(path)) return "watch";
    } catch { /* not a URL */ }
  }
  const t = [row.ad_name, row.adset_name, row.campaign_name].filter(Boolean).join(" ").toLowerCase();
  const j = new RegExp(JEWEL_WORDS.join("|")).test(t), w = new RegExp(WATCH_WORDS.join("|")).test(t);
  return j === w ? null : j ? "jewel" : "watch";
}

/** Meta ad id / ad set id / campaign id / lowercase campaign name -> kind. An ad set or campaign only when all its ads agree. */
async function metaAdMap(): Promise<Record<string, "jewel" | "watch">> {
  const out: Record<string, "jewel" | "watch"> = {};
  try {
    const { data, error } = await supabaseAdmin()
      .from("meta_ads")
      .select("ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, product_slug, landing_url")
      .limit(5000);
    if (error || !data) return out;
    const groups = new Map<string, Set<string>>();
    const add = (k: string | null | undefined, v: string) => { if (!k) return; const key = String(k).trim().toLowerCase(); (groups.get(key) ?? groups.set(key, new Set()).get(key)!).add(v); };
    for (const r of data) {
      const kind = kindOf(r) ?? "none";
      if (kind !== "none") out[String(r.ad_id)] = kind;
      add(r.adset_id, kind); add(r.campaign_id, kind); add(r.campaign_name, kind);
    }
    for (const [k, kinds] of groups) if (kinds.size === 1 && !kinds.has("none") && !(k in out)) out[k] = [...kinds][0] as "jewel" | "watch";
  } catch { /* no database at build time: words + landing page still work */ }
  return out;
}

export async function heroSourceCfg(avail: HeroSlideKey[]): Promise<HeroSourceCfg> {
  return { jw: JEWEL_WORDS.join("|"), wt: WATCH_WORDS.join("|"), jp: JEWEL_PATH, wp: WATCH_PATH, ids: await metaAdMap(), avail };
}
