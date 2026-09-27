-- "Bags" category (Milano Avorio duffel + 5 clutches) — wallet_inventory rows,
-- read by the atomic reserve_wallet_stock() at order time. The RPC is slug-driven
-- and generic, so these rows are all it needs.
--
-- Quantities confirmed by the owner 2026-09-27. Safe to re-run: ON CONFLICT DO
-- NOTHING never overwrites a row that already exists — if the SELECT below shows
-- a different number, that row was there before and kept its live value.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

INSERT INTO wallet_inventory (slug, stock)
VALUES
  ('bag-milano-avorio', 1),   -- one-of-a-kind piece
  ('clutch-torino',     5),   -- black
  ('clutch-verona',     5),   -- burgundy
  ('clutch-toscana',    2),   -- dark green
  ('clutch-portofino',  5),   -- cream
  ('clutch-capri',      3)    -- navy
ON CONFLICT (slug) DO NOTHING;

SELECT slug, stock FROM wallet_inventory WHERE slug LIKE 'bag-%' OR slug LIKE 'clutch-%' ORDER BY slug;
