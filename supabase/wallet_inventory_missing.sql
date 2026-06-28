-- Add missing cardholder rows to wallet_inventory
-- Run in Supabase: Dashboard → SQL Editor → paste → Run
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

INSERT INTO wallet_inventory (slug, stock)
VALUES
  ('cardholder-ambra',     15),
  ('cardholder-valentina', 15),
  ('cardholder-zaffiro',   15)
ON CONFLICT (slug) DO NOTHING;

-- Verify result
SELECT slug, stock FROM wallet_inventory ORDER BY slug;
