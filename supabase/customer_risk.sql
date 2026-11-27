-- ============================================================================
-- НЕКОРЕКТНИ КЛИЕНТИ (27.11.2026)
--   1. lr_norm_phone(text)        - ONE phone format for the whole database: +359XXXXXXXXX
--                                   (0888…, 359888…, 00359 888…, +359 888-… are the same number)
--   2. index on orders(lr_norm_phone(phone))
--   3. customer_flags              - manual "Маркирай като некоректен" (one row per normalized phone)
--   4. external_risk_checks        - cached Nekorekten.com answers (re-checked only when older than 7 days)
--   5. external_reports_sent       - every report we sent to Nekorekten.com (who, when, what)
--   6. customer_risk(phone) and customer_risk_many(phones[]) - the risk of a customer, from OUR orders
--      (every storefront in this table, chronobg included) + the manual flag + the cached external check.
--      The panel calls customer_risk_many ONCE for the whole orders page (no N+1).
--
-- Source of the incidents = the existing returns system (no new status logic):
--   status IN ('returning','restocked','returned')  = the parcel came back (never collected)
--   return_kind = 'refused'      -> ОТКАЗАНА   (came to the office, declined)
--   return_kind = 'uncollected'  -> НЕПОТЪРСЕНА
--   return_kind NULL             -> ВЪРНАТА (Econt has not classified it yet) - still an incident
-- Fake / test orders (excluded_from_stock) never count.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard -> SQL Editor -> paste -> Run. Safe to re-run.
-- ============================================================================

-- 1. Phone normalization ------------------------------------------------------
CREATE OR REPLACE FUNCTION lr_norm_phone(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  IF left(d, 2) = '00' THEN d := substr(d, 3); END IF;          -- 00359… -> 359…
  IF left(d, 3) = '359' AND length(d) >= 11 THEN                -- 359888… / 3590888…
    d := substr(d, 4);
    IF left(d, 1) = '0' THEN d := substr(d, 2); END IF;
    RETURN '+359' || d;
  END IF;
  IF left(d, 1) = '0' AND length(d) = 10 THEN RETURN '+359' || substr(d, 2); END IF;   -- 0888123456
  IF length(d) = 9 AND left(d, 1) IN ('8', '9') THEN RETURN '+359' || d; END IF;       -- 888123456 (the 0 forgotten)
  RETURN '+' || d;                                              -- a foreign number (+40…): keep it as E.164
END $$;

CREATE INDEX IF NOT EXISTS orders_phone_norm_idx ON orders (lr_norm_phone(phone));

-- 2. Manual flags ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_flags (
  phone_norm        text PRIMARY KEY,
  flagged           boolean NOT NULL DEFAULT true,     -- false = the mark was removed (row kept: who removed it, why)
  note              text,
  updated_by_email  text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_flags ENABLE ROW LEVEL SECURITY;   -- no policies: service role only (the panel's server code)

-- 3. External checks cache ------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_risk_checks (
  phone          text NOT NULL,                        -- lr_norm_phone() form
  source         text NOT NULL,                        -- 'nekorekten'
  reports_count  integer,                              -- NULL = never answered successfully
  raw_json       jsonb,
  checked_at     timestamptz,                          -- last SUCCESSFUL answer (the 7-day cache key)
  last_error     text,
  last_error_at  timestamptz,
  PRIMARY KEY (phone, source)
);
ALTER TABLE external_risk_checks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS external_reports_sent (
  id             bigserial PRIMARY KEY,
  order_id       bigint,
  phone          text NOT NULL,
  source         text NOT NULL,
  payload        jsonb,                                -- exactly what was sent
  response       jsonb,
  sent_by_email  text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_reports_sent_order_idx ON external_reports_sent (order_id);
ALTER TABLE external_reports_sent ENABLE ROW LEVEL SECURITY;

-- 4. Risk -----------------------------------------------------------------------
-- One row per INPUT phone (as the caller wrote it), so the panel maps it straight back to its orders.
DROP FUNCTION IF EXISTS customer_risk(text);
DROP FUNCTION IF EXISTS customer_risk_many(text[]);
CREATE FUNCTION customer_risk_many(p_phones text[])
RETURNS TABLE (
  input_phone      text,
  phone_norm       text,
  uncollected      integer,
  refused          integer,
  returned_other   integer,
  completed        integer,
  last_incident_at timestamptz,
  incidents        jsonb,        -- [{id, ref, kind, at, site}] newest first
  manual_flag      boolean,
  manual_note      text,
  manual_by        text,
  manual_at        timestamptz,
  ext_reports      integer,
  ext_checked_at   timestamptz,
  ext_error        text,
  ext_error_at     timestamptz
)
LANGUAGE sql STABLE AS $$
  WITH inp AS (
    SELECT DISTINCT x AS input_phone, lr_norm_phone(x) AS phone_norm
    FROM unnest(p_phones) AS x
    WHERE lr_norm_phone(x) IS NOT NULL
  ),
  o AS (
    SELECT lr_norm_phone(o.phone) AS phone_norm, o.id, o.order_ref, o.status::text AS status, o.return_kind,
           coalesce(o.returning_at, o.restocked_at, o.created_at) AS at, o.source_site
    FROM orders o
    WHERE lr_norm_phone(o.phone) IN (SELECT phone_norm FROM inp)
      AND NOT coalesce(o.excluded_from_stock, false)
  ),
  agg AS (
    SELECT phone_norm,
      count(*) FILTER (WHERE status IN ('returning','restocked','returned') AND coalesce(return_kind, '') = 'uncollected')::int AS uncollected,
      count(*) FILTER (WHERE status IN ('returning','restocked','returned') AND return_kind = 'refused')::int                   AS refused,
      count(*) FILTER (WHERE status IN ('returning','restocked','returned') AND coalesce(return_kind, '') NOT IN ('uncollected','refused'))::int AS returned_other,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      max(at) FILTER (WHERE status IN ('returning','restocked','returned')) AS last_incident_at,
      coalesce(jsonb_agg(jsonb_build_object('id', id, 'ref', order_ref, 'kind', coalesce(return_kind, 'returned'), 'at', at, 'site', source_site)
               ORDER BY at DESC) FILTER (WHERE status IN ('returning','restocked','returned')), '[]'::jsonb) AS incidents
    FROM o GROUP BY phone_norm
  )
  SELECT i.input_phone, i.phone_norm,
         coalesce(a.uncollected, 0), coalesce(a.refused, 0), coalesce(a.returned_other, 0), coalesce(a.completed, 0),
         a.last_incident_at, coalesce(a.incidents, '[]'::jsonb),
         coalesce(f.flagged, false), f.note, f.updated_by_email, f.updated_at,
         e.reports_count, e.checked_at, e.last_error, e.last_error_at
  FROM inp i
  LEFT JOIN agg a ON a.phone_norm = i.phone_norm
  LEFT JOIN customer_flags f ON f.phone_norm = i.phone_norm
  LEFT JOIN external_risk_checks e ON e.phone = i.phone_norm AND e.source = 'nekorekten';
$$;

-- One customer (same columns). DROP first: re-running after a column change must not fail on "cannot change return type".
DROP FUNCTION IF EXISTS customer_risk(text);
CREATE FUNCTION customer_risk(p_phone text)
RETURNS TABLE (
  input_phone text, phone_norm text, uncollected integer, refused integer, returned_other integer, completed integer,
  last_incident_at timestamptz, incidents jsonb, manual_flag boolean, manual_note text, manual_by text, manual_at timestamptz,
  ext_reports integer, ext_checked_at timestamptz, ext_error text, ext_error_at timestamptz
)
LANGUAGE sql STABLE AS $$ SELECT * FROM customer_risk_many(ARRAY[p_phone]) $$;

-- Customer data: never callable with the public key or a logged-in browser token (the panel reads through the service role).
REVOKE EXECUTE ON FUNCTION customer_risk_many(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION customer_risk(text)        FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION customer_risk_many(text[]) TO service_role;
GRANT  EXECUTE ON FUNCTION customer_risk(text)        TO service_role;

-- Check (should list the same normalized number three times):
-- SELECT lr_norm_phone('0888 123 456'), lr_norm_phone('359888123456'), lr_norm_phone('+359 (888) 12-34-56');
