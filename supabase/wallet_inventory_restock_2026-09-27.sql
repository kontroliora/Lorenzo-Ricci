-- Cardholder stock, 2026-09-27 (owner's counts).
--
--   Existing products (added to):
--   cardholder-bianco     white    2 → 88   (+86 = three batches: 38 + 27 + 21)
--   cardholder-ambra      orange   9 → 10   (+1)
--   cardholder-valentina  pink    10 → 19   (+9)
--
--   New products (first row):
--   cardholder-onice      black    new → 46
--   cardholder-giada      green    new → 27
--   cardholder-cremisi    red      new → 38
--   cardholder-perla      grey     new → 3
--   cardholder-topazio    yellow   new → 23
--
-- All-or-nothing: each change to an existing product applies only if its live
-- stock is still the "before" value read on 2026-09-27, and each new row must not
-- exist yet. If anything differs — e.g. an order came in meanwhile — the block
-- stops with an error and NOTHING changes; re-read and recompute rather than
-- forcing it. A second run after success also stops, so stock can't be added twice.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

DO $$
DECLARE n int;
BEGIN
  UPDATE wallet_inventory SET stock = stock + 86 WHERE slug = 'cardholder-bianco' AND stock = 2;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'cardholder-bianco is no longer 2 — nothing applied'; END IF;

  UPDATE wallet_inventory SET stock = stock + 1 WHERE slug = 'cardholder-ambra' AND stock = 9;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'cardholder-ambra is no longer 9 — nothing applied'; END IF;

  UPDATE wallet_inventory SET stock = stock + 9 WHERE slug = 'cardholder-valentina' AND stock = 10;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'cardholder-valentina is no longer 10 — nothing applied'; END IF;

  -- Plain INSERTs (no ON CONFLICT): if any of these rows somehow exists already,
  -- the whole block stops rather than silently keeping an unknown value.
  INSERT INTO wallet_inventory (slug, stock) VALUES
    ('cardholder-onice',   46),
    ('cardholder-giada',   27),
    ('cardholder-cremisi', 38),
    ('cardholder-perla',    3),
    ('cardholder-topazio', 23);
END $$;

SELECT slug, stock FROM wallet_inventory WHERE slug LIKE 'cardholder-%' ORDER BY slug;
