-- Atomic stock guard for leather goods (wallet_inventory).
-- Run in Supabase SQL Editor BEFORE deploying the matching code.
--
-- Fixes overselling: the old decrement floored at 0 and never blocked, so an
-- order for 2 with 1 in stock still went through. reserve_wallet_stock() checks
-- ALL items under a row lock and only decrements when every one fits — otherwise
-- it decrements nothing and returns the shortfall. restock_wallet_stock() puts
-- units back when an order is cancelled/returned (stops the downward drift).

-- ── reserve: atomic check-and-decrement ─────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_wallet_stock(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it        jsonb;
  v_slug    text;
  v_qty     int;
  v_stock   int;
  shortfall jsonb := '[]'::jsonb;
BEGIN
  -- Pass 1 — lock each row and check. No writes yet, so nothing to roll back
  -- if we bail out. FOR UPDATE holds the locks until the function's txn ends,
  -- so a concurrent order can't slip between the check and the decrement.
  FOR it IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS t(value)
  LOOP
    v_slug := it->>'slug';
    v_qty  := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    SELECT stock INTO v_stock FROM wallet_inventory WHERE slug = v_slug FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;  -- not tracked in wallet_inventory (e.g. a watch) — skip
    END IF;
    IF v_stock < v_qty THEN
      shortfall := shortfall || jsonb_build_object('slug', v_slug, 'available', v_stock, 'requested', v_qty);
    END IF;
  END LOOP;

  IF jsonb_array_length(shortfall) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'shortfall', shortfall);
  END IF;

  -- Pass 2 — everything fits → decrement (rows still locked in this txn).
  FOR it IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS t(value)
  LOOP
    v_slug := it->>'slug';
    v_qty  := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    UPDATE wallet_inventory SET stock = stock - v_qty WHERE slug = v_slug;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── restock: put units back (cancel / return) ───────────────────────────────
CREATE OR REPLACE FUNCTION restock_wallet_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it     jsonb;
  v_slug text;
  v_qty  int;
BEGIN
  FOR it IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS t(value)
  LOOP
    v_slug := it->>'slug';
    v_qty  := GREATEST(1, COALESCE((it->>'qty')::int, 1));
    UPDATE wallet_inventory SET stock = stock + v_qty WHERE slug = v_slug;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION reserve_wallet_stock(jsonb) FROM public;
REVOKE ALL ON FUNCTION restock_wallet_stock(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION reserve_wallet_stock(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION restock_wallet_stock(jsonb) TO anon, authenticated;

-- ── Bianco fix ──────────────────────────────────────────────────────────────
-- You set 0 in the admin inventory (which writes Vercel KV), but the storefront
-- and the atomic guard read wallet_inventory — where Bianco was still 1. Set the
-- real source to 0. (Longer term: the "unify" step so admin writes here too.)
UPDATE wallet_inventory SET stock = 0 WHERE slug = 'cardholder-bianco';

SELECT slug, stock FROM wallet_inventory ORDER BY slug;
