-- ============================================================================
-- owner_revenue() — turnover from actually-delivered parcels. OWNER ONLY.
--
-- Counts ONLY status='completed' (Econt-confirmed delivered), excludes fake/test
-- (excluded_from_stock). "Оборот от стока" = total - shipping_cost = the real
-- product money AFTER discounts (shipping is Econt's, not revenue). Periods are
-- bucketed by completed_at (falls back to created_at) in Europe/Sofia time.
--
-- SECURITY DEFINER + is_owner() guard: the employee (koko@) gets NULL even on a
-- direct call — the aggregate never leaves the DB for a non-owner. No new
-- columns. Idempotent, re-runnable.
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

  WITH completed AS (
    SELECT
      (coalesce(completed_at, created_at) AT TIME ZONE 'Europe/Sofia')  AS rev_s,
      coalesce(total, 0)::numeric                                        AS total,
      coalesce(shipping_cost, 0)::numeric                               AS shipping,
      coalesce(total, 0)::numeric - coalesce(shipping_cost, 0)::numeric AS goods,
      items
    FROM orders
    WHERE status = 'completed' AND coalesce(excluded_from_stock, false) = false
  ),
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
    'top_products',  top.products
  ) INTO result
  FROM period, top;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION owner_revenue() FROM public;
GRANT EXECUTE ON FUNCTION owner_revenue() TO authenticated;
