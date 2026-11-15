// Home hero (BG): which slide comes FIRST, by traffic source (owner, 15.11.2026). All slides stay in the slider; only the order changes.
//   - a JEWELLERY ad / campaign  -> "Дамска колекция" first
//   - a WATCH ad / campaign      -> the watch + cardholder slide first
//   - everyone else (direct, organic, Instagram bio, e-mail, an ad we cannot place) -> the general brand slide first
//
// How a visit is placed (decideHeroFirst, below), in this order:
//   1. Only ad clicks count: the landing URL carries fbclid / gclid / ttclid / msclkid / utm_*; utm_medium or utm_source saying e-mail,
//      newsletter, bio, organic, referral, sms, push or viber = not an ad (general).
//   2. A utm value that is a known Meta ad / ad set / campaign id or campaign name (meta_ads, lib/hero-source-server.ts: the ad's
//      product, landing page and names decide its kind). Our ads carry utm_campaign={{ad.id}}, so this is the usual route.
//   3. Words in the utm values (campaign / ad set / ad names): jewellery words vs watch words; both or none = undecided.
//   4. The landing page: /jewellery or a jewellery product -> jewellery, /watches or a watch -> watch.
// The landing is recorded once per tab (app/layout.tsx, sessionStorage "lr_ad_src", last ad click wins), so a visitor who lands on a
// product page and opens the home page later gets the same order; the decision is kept in sessionStorage "lr_hero_first" so the order
// never jumps between pages. A slide that is not available (sold out) is never first: the general slide takes its place.

export type HeroSlideKey = "general" | "jewel" | "watch";
export type HeroSourceCfg = {
  /** Regex sources (lowercase text). */
  jw: string; wt: string; jp: string; wp: string;
  /** Meta ad / ad set / campaign id or lowercase campaign name -> kind. */
  ids: Record<string, "jewel" | "watch">;
  /** The slides on the page, in default order. */
  avail: HeroSlideKey[];
};

/** Recorded in <head> on every page (app/layout.tsx): the landing of the last ad click in this tab. */
export const AD_SRC_SCRIPT =
  'try{var s=location.search;if(/[?&](fbclid|gclid|ttclid|msclkid|utm_[a-z_]+)=/i.test(s))sessionStorage.setItem("lr_ad_src",JSON.stringify({q:s,p:location.pathname}))}catch(e){}';

/**
 * Decides the first slide and marks it on <html data-hero-first>. SELF-CONTAINED on purpose (no imports, no outer names): the home
 * page inlines it as a <script> before the hero, so the right slide shows on the very first paint (globals.css, data-hero-pending),
 * and the Hero component calls the same function after a client-side navigation.
 */
export function decideHeroFirst(cfg: HeroSourceCfg): HeroSlideKey {
  var first = "general";
  try {
    var raw = sessionStorage.getItem("lr_ad_src") || "";
    var memo = sessionStorage.getItem("lr_hero_first");
    var m = memo ? JSON.parse(memo) : null;
    if (m && m.src === raw && m.first) {
      first = m.first;
    } else {
      if (raw) {
        var src = JSON.parse(raw);
        var q = new URLSearchParams(src.q || "");
        var how = ((q.get("utm_medium") || "") + " " + (q.get("utm_source") || "")).toLowerCase();
        if (!/mail|newsletter|bio|organic|referral|sms|push|viber/.test(how)) {
          var vals: string[] = [];
          q.forEach(function (v, k) { if (!/^(fbclid|gclid|ttclid|msclkid|_ga|_gl)$/i.test(k)) vals.push(String(v).trim().toLowerCase()); });
          var hit = "";
          for (var i = 0; i < vals.length && !hit; i++) hit = cfg.ids[vals[i]] || "";
          if (!hit) {
            var t = vals.join(" ");
            var j = new RegExp(cfg.jw).test(t), w = new RegExp(cfg.wt).test(t);
            if (j !== w) hit = j ? "jewel" : "watch";
          }
          if (!hit) {
            var p = String(src.p || "").toLowerCase();
            if (new RegExp(cfg.jp).test(p)) hit = "jewel";
            else if (new RegExp(cfg.wp).test(p)) hit = "watch";
          }
          if (hit) first = hit;
        }
      }
      sessionStorage.setItem("lr_hero_first", JSON.stringify({ src: raw, first: first }));
    }
  } catch {
    first = "general";
  }
  if (cfg.avail.indexOf(first as HeroSlideKey) < 0) first = cfg.avail.indexOf("general") >= 0 ? "general" : cfg.avail[0] || "general";
  document.documentElement.setAttribute("data-hero-first", first);
  return first as HeroSlideKey;
}

/** The inline <script> for the home page. */
export const heroFirstScript = (cfg: HeroSourceCfg): string =>
  `(${decideHeroFirst.toString()})(${JSON.stringify(cfg).replace(/</g, "\\u003c")})`;
