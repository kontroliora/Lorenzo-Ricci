-- Card payments with Stripe (Checkout), next to cash on delivery.
-- PROJECT: xefgrsgijjrmctzezosg (kontroliora's Project, "main", PRODUCTION) - check the ref in the URL before running.
-- Run in Supabase: Dashboard -> SQL Editor -> paste -> Run. Safe to run more than once. Additive only: every existing
-- order keeps working (payment_method defaults to 'cod', payment_status to 'unpaid').
--
-- Lifecycle of a card order:
--   created      status 'pending_payment' + payment_status 'pending' - stock is RESERVED, the order is hidden from the
--                fulfilment board and from every Econt flow
--   paid         Stripe webhook (checkout.session.completed / async_payment_succeeded): status 'new',
--                payment_status 'paid', paid_at set - from here on it is a normal order, with the courier collecting 0
--   not paid     Stripe session expired (30 min) / failed: status 'cancelled', payment_status 'expired',
--                the reserved stock is put back (restock_wallet_stock)

-- 1. a new order status (orders.status is the enum order_status). Nothing below uses the new value: Postgres refuses to use an enum
--    value in the same transaction that added it, and the SQL editor runs a pasted script as one transaction.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- 2. payment columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method        text        NOT NULL DEFAULT 'cod',   -- 'cod' | 'card'
  ADD COLUMN IF NOT EXISTS payment_status        text        NOT NULL DEFAULT 'unpaid',-- 'unpaid' (cod, collected by the courier) | 'pending' | 'paid' | 'expired' | 'failed' | 'refunded'
  ADD COLUMN IF NOT EXISTS stripe_session_id     text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS paid_at               timestamptz,
  ADD COLUMN IF NOT EXISTS payment_currency      text;                                  -- 'EUR' | 'RON'

-- notifications of a paid order (e-mails, Meta Purchase) are claimed once and marked done: a webhook that dies half-way is finished later
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notify_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_at       timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_uidx ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_pending_payment_idx ON orders (created_at) WHERE payment_status = 'pending';

-- 3. one row per processed Stripe event: a repeated webhook delivery is recognised and ignored
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     text        PRIMARY KEY,
  type         text        NOT NULL,
  order_ref    text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  result       text                                  -- what was done: 'paid' | 'expired' | 'ignored' | 'refunded' | ...
);
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;   -- no policies: server (service role) only

-- 4. an order reference must identify ONE order (every payment lookup is by reference). Created only if no duplicates exist;
--    otherwise a NOTICE says so - fix the duplicates (SELECT order_ref, count(*) FROM orders GROUP BY 1 HAVING count(*) > 1) and run again.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE order_ref IS NOT NULL GROUP BY order_ref HAVING count(*) > 1) THEN
    RAISE NOTICE 'orders.order_ref has duplicates: the unique index was NOT created. Fix them, then run this script again.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS orders_order_ref_uidx ON orders (order_ref) WHERE order_ref IS NOT NULL;
  END IF;
END $$;

-- 5. a single-use promo code is CLAIMED when a card order is created (promo_mark_used) and given back when that order is not
--    paid. Only the server (service role) may call it.
CREATE OR REPLACE FUNCTION promo_release(p_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $f$
DECLARE v_n int;
BEGIN
  UPDATE newsletter_subscribers
     SET code_used = false
   WHERE promo_code = upper(trim(coalesce(p_code, ''))) AND code_used = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$f$;
REVOKE ALL ON FUNCTION promo_release(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION promo_release(text) TO service_role;

-- Check after running (the new columns, the enum value, the function):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('payment_method','payment_status','stripe_session_id','notified_at');  -- 4 rows
-- SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname IN ('orders_order_ref_uidx','orders_stripe_session_uidx');  -- 2 rows (order_ref only if no duplicates)
-- SELECT proname FROM pg_proc WHERE proname = 'promo_release';  -- 1 row
-- SELECT unnest(enum_range(NULL::order_status));
