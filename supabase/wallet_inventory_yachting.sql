-- Yachting watches (Black/Blue/White) — wallet_inventory rows, read by the atomic
-- reserve_wallet_stock() at order time. The RPC is slug-driven and generic, so
-- these rows are all it needs.
--
-- Quantities confirmed by the owner 2026-09-27. Safe to re-run: ON CONFLICT DO
-- NOTHING never overwrites a row that already exists — if the SELECT below shows
-- a different number, that row was there before and kept its live value.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

INSERT INTO wallet_inventory (slug, stock)
VALUES
  ('yachting-black', 200),
  ('yachting-blue',  100),
  ('yachting-white', 197)
ON CONFLICT (slug) DO NOTHING;

SELECT slug, stock FROM wallet_inventory WHERE slug LIKE 'yachting-%' ORDER BY slug;
