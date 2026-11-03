-- New cardholder "Panna" (creamy white), 2026-11-03 (owner's count): cardholder-panna → 30.
--
-- Idempotent: inserts the row with 30 only if it does not exist yet. A second run changes nothing
-- (it never resets a stock that orders have already reduced). Other products are not touched.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

INSERT INTO wallet_inventory (slug, stock)
VALUES ('cardholder-panna', 30)
ON CONFLICT (slug) DO NOTHING;

SELECT slug, stock FROM wallet_inventory WHERE slug = 'cardholder-panna';
