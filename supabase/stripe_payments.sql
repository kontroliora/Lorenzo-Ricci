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

-- Check after running (3 rows expected; 'pending_payment' listed among the enum values):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('payment_method','payment_status','stripe_session_id');
-- SELECT unnest(enum_range(NULL::order_status));
