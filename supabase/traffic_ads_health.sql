-- Traffic (page_views), automatic Meta ads data (meta_ads + meta_ad_insights) and the panel's health checks (health_status).
-- Additive only: no existing table is changed. Safe to run more than once.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
-- Every table: RLS on, NO policies -> only the server (service role) reads/writes. The panel reads through owner-gated server code.

-- ── Traffic ──────────────────────────────────────────────────────────────────
-- One row per page view of a real person (the browser waits for the same "human gate" as the Meta pixel, so ad-review scrapers
-- and click farms are not counted). Written by /api/pv. No personal data: vid is a random id in the visitor's browser, no IP.
CREATE TABLE IF NOT EXISTS page_views (
  id            bigserial   PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  vid           text        NOT NULL,           -- random per browser (localStorage), = one visitor
  sid           text        NOT NULL,           -- random per tab session (sessionStorage)
  market        text        NOT NULL,           -- bg | ro (from the path: /ro = ro)
  path          text        NOT NULL,
  product_slug  text,                           -- /products/<slug> and /ro/produse/<slug>
  referrer_host text,                           -- external referrer of the session's first page only
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  fbclid        boolean     NOT NULL DEFAULT false,
  country       text,                           -- Cloudflare / Vercel IP country (ISO-2), no IP stored
  device        text                            -- mobile | tablet | desktop
);
CREATE INDEX IF NOT EXISTS page_views_created_idx ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_market_created_idx ON page_views (market, created_at DESC);
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Old rows go after 400 days (the panel looks back 30 days).
-- DELETE FROM page_views WHERE created_at < now() - interval '400 days';

-- Aggregates for the ТРАФИК tab in one call (a plain select would stop at PostgREST's 1000-row cap). p_market: 'bg' | 'ro' | NULL = both.
-- Service role only (the panel calls it from owner-gated server code).
CREATE OR REPLACE FUNCTION traffic_summary(p_start timestamptz, p_end timestamptz, p_market text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH pv AS (
    SELECT * FROM page_views
    WHERE created_at >= p_start AND created_at <= p_end AND (p_market IS NULL OR market = p_market)
  ),
  landing AS (   -- the first page of each session carries its source
    SELECT DISTINCT ON (sid) sid, vid,
      CASE
        WHEN utm_source IS NOT NULL THEN lower(utm_source) || ' (utm)'
        WHEN fbclid THEN 'facebook / instagram реклама'
        WHEN referrer_host IS NOT NULL THEN referrer_host
        ELSE 'директно'
      END AS source
    FROM pv ORDER BY sid, created_at
  )
  SELECT jsonb_build_object(
    'visitors',  (SELECT count(DISTINCT vid) FROM pv),
    'sessions',  (SELECT count(DISTINCT sid) FROM pv),
    'pageviews', (SELECT count(*) FROM pv),
    'daily', COALESCE((SELECT jsonb_agg(d ORDER BY d.day) FROM (
        SELECT to_char(created_at AT TIME ZONE 'Europe/Sofia', 'YYYY-MM-DD') AS day, count(DISTINCT vid) AS visitors, count(*) AS views
        FROM pv GROUP BY 1) d), '[]'::jsonb),
    'pages', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT path, count(*) AS views, count(DISTINCT vid) AS visitors FROM pv GROUP BY path ORDER BY 2 DESC LIMIT 15) t), '[]'::jsonb),
    'sources', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT source, count(*) AS sessions, count(DISTINCT vid) AS visitors FROM landing GROUP BY source ORDER BY 2 DESC LIMIT 12) t), '[]'::jsonb),
    'products', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT product_slug AS slug, count(*) AS views, count(DISTINCT vid) AS visitors FROM pv WHERE product_slug IS NOT NULL
        GROUP BY product_slug ORDER BY 2 DESC) t), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT COALESCE(device, '?') AS device, count(DISTINCT vid) AS visitors FROM pv GROUP BY 1 ORDER BY 2 DESC) t), '[]'::jsonb),
    'countries', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT COALESCE(country, '?') AS country, count(DISTINCT vid) AS visitors FROM pv GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t), '[]'::jsonb),
    'campaigns', COALESCE((SELECT jsonb_agg(t) FROM (
        SELECT utm_campaign AS campaign, utm_content AS content, count(DISTINCT sid) AS sessions, count(DISTINCT vid) AS visitors
        FROM pv WHERE utm_campaign IS NOT NULL GROUP BY 1, 2) t), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION traffic_summary(timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION traffic_summary(timestamptz, timestamptz, text) TO service_role;

-- ── Meta ads ─────────────────────────────────────────────────────────────────
-- One row per ad (latest known state). market from the ad set's targeting (RO only -> ro, else bg); product_slug from the ad's
-- landing URL (/products/<slug>, /ro/produse/<slug>). Filled by /api/cron/meta-ads.
CREATE TABLE IF NOT EXISTS meta_ads (
  ad_id            text        PRIMARY KEY,
  ad_name          text,
  adset_id         text,
  adset_name       text,
  campaign_id      text,
  campaign_name    text,
  effective_status text,                        -- ACTIVE, PAUSED, CAMPAIGN_PAUSED ...
  market           text        NOT NULL DEFAULT 'bg',
  landing_url      text,
  product_slug     text,
  url_tags         text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meta_ads ENABLE ROW LEVEL SECURITY;

-- One row per ad per day (account time zone Europe/Sofia), straight from the Insights API. Re-pulled for yesterday + today every
-- hour, so the latest numbers overwrite the earlier ones. Kept apart from the manual ad_spend ledger on purpose.
CREATE TABLE IF NOT EXISTS meta_ad_insights (
  date           date        NOT NULL,
  ad_id          text        NOT NULL,
  adset_id       text,
  campaign_id    text,
  market         text        NOT NULL DEFAULT 'bg',
  spend          numeric(10,2) NOT NULL DEFAULT 0,   -- EUR (the account currency)
  impressions    integer     NOT NULL DEFAULT 0,
  clicks         integer     NOT NULL DEFAULT 0,     -- all clicks, as Meta reports them
  link_clicks    integer     NOT NULL DEFAULT 0,
  ctr            numeric(8,4),                       -- %
  cpm            numeric(10,4),                      -- EUR
  purchases      integer     NOT NULL DEFAULT 0,     -- Meta-reported (pixel + CAPI)
  purchase_value numeric(10,2) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, ad_id)
);
CREATE INDEX IF NOT EXISTS meta_ad_insights_date_idx ON meta_ad_insights (date DESC);
ALTER TABLE meta_ad_insights ENABLE ROW LEVEL SECURITY;

-- ── Health ───────────────────────────────────────────────────────────────────
-- One row per check (key). ok = false is an open problem; since = when it started; last_alerted_at = last Telegram message
-- (at most one per hour per problem). The row '_run' records when the checks last ran. Written by /api/cron/health.
CREATE TABLE IF NOT EXISTS health_status (
  key             text        PRIMARY KEY,
  ok              boolean     NOT NULL DEFAULT true,
  title           text        NOT NULL DEFAULT '',
  detail          text,
  since           timestamptz,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  last_alerted_at timestamptz
);
ALTER TABLE health_status ENABLE ROW LEVEL SECURITY;

-- Check after running:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('page_views','meta_ads','meta_ad_insights','health_status');
