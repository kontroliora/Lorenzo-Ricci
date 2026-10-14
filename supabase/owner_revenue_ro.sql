-- ============================================================================
-- owner_revenue() v2 - Romanian orders (ship_country = 'RO') are in LEI.
--
-- They are taken OUT of the euro figures (a delivered Romanian order of 735 lei must not count as EUR 735) and returned
-- separately under "ro" (all numbers in lei). Everything else is exactly as in owner_revenue.sql: only status='completed',
-- fakes (excluded_from_stock) excluded, "goods" = total - shipping, months bucketed in Europe/Sofia time, OWNER ONLY.
-- Idempotent. Safe to run BEFORE the Romanian site is merged: until the panel code knows "ro" it simply ignores the key.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
-- ============================================================================

CREATE OR REPLACE FUNCTION owner_revenue()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cur_start  timestamp := date_trunc('month', now() AT TIME ZONE 'Europe/Sofia');
  next_start timestamp := date_trunc('month', now() AT TIME ZONE 'Europe/Sofia') + interval '1 month';
  prev_start timestamp := date_trunc('month', now() AT TIME ZONE 'Europe/Sofia') - interval '1 month';
  result jsonb;
BEGIN
  IF NOT is_owner() THEN
    RETURN NULL;  -- non-owner gets nothing
  END IF;

  WITH all_completed AS (
    SELECT
      (coalesce(completed_at, created_at) AT TIME ZONE 'Europe/Sofia')  AS rev_s,
      coalesce(total, 0)::numeric                                        AS total,
      coalesce(shipping_cost, 0)::numeric                               AS shipping,
      coalesce(total, 0)::numeric - coalesce(shipping_cost, 0)::numeric AS goods,
      items,
      (coalesce(ship_country, '') = 'RO')                               AS is_ro
    FROM orders
    WHERE status = 'completed' AND coalesce(excluded_from_stock, false) = false
  ),
  completed AS (SELECT * FROM all_completed WHERE NOT is_ro),      -- euro figures: everything except Romania
  completed_ro AS (SELECT * FROM all_completed WHERE is_ro),       -- Romania, lei
  period AS (
    SELECT
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods)    FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'collected', round(coalesce(sum(total)    FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'shipping',  round(coalesce(sum(shipping) FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'count',     coalesce(count(*)            FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0)
      ) AS current_month,
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods)    FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'collected', round(coalesce(sum(total)    FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'shipping',  round(coalesce(sum(shipping) FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'count',     coalesce(count(*)            FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0)
      ) AS last_month,
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods), 0), 2),
        'collected', round(coalesce(sum(total), 0), 2),
        'shipping',  round(coalesce(sum(shipping), 0), 2),
        'count',     coalesce(count(*), 0)
      ) AS all_time
    FROM completed
  ),
  period_ro AS (
    SELECT
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods)    FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'collected', round(coalesce(sum(total)    FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'shipping',  round(coalesce(sum(shipping) FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0), 2),
        'count',     coalesce(count(*)            FILTER (WHERE rev_s >= cur_start AND rev_s < next_start), 0)
      ) AS current_month,
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods)    FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'collected', round(coalesce(sum(total)    FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'shipping',  round(coalesce(sum(shipping) FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0), 2),
        'count',     coalesce(count(*)            FILTER (WHERE rev_s >= prev_start AND rev_s < cur_start), 0)
      ) AS last_month,
      jsonb_build_object(
        'revenue',   round(coalesce(sum(goods), 0), 2),
        'collected', round(coalesce(sum(total), 0), 2),
        'shipping',  round(coalesce(sum(shipping), 0), 2),
        'count',     coalesce(count(*), 0)
      ) AS all_time
    FROM completed_ro
  ),
  top AS (
    SELECT coalesce(jsonb_agg(t ORDER BY t.revenue DESC), '[]'::jsonb) AS products
    FROM (
      SELECT
        (item->>'name') AS name,
        sum(coalesce(nullif(item->>'quantity','')::numeric, nullif(item->>'qty','')::numeric, 1)) AS qty,
        round(sum(coalesce(nullif(item->>'price','')::numeric, 0)
                  * coalesce(nullif(item->>'quantity','')::numeric, nullif(item->>'qty','')::numeric, 1)), 2) AS revenue
      FROM completed, jsonb_array_elements(items) AS item
      WHERE coalesce(item->>'name','') <> ''
      GROUP BY item->>'name'
      ORDER BY revenue DESC
      LIMIT 8
    ) t
  )
  SELECT jsonb_build_object(
    'current_month', period.current_month,
    'last_month',    period.last_month,
    'all_time',      period.all_time,
    'top_products',  top.products,
    'ro', jsonb_build_object(
      'current_month', period_ro.current_month,
      'last_month',    period_ro.last_month,
      'all_time',      period_ro.all_time
    )
  ) INTO result
  FROM period, period_ro, top;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION owner_revenue() FROM public;
GRANT EXECUTE ON FUNCTION owner_revenue() TO authenticated;

-- Check (as the owner, in the app): the euro figures no longer include Romanian orders; "ro" appears in the result.
