-- Red wallet "Rubino" (wallet-rubino, SKU WLT-RUB) sold out, 2026-11-11 (owner): free-to-sell stock -> 0.
-- Only this one row is touched; Alabastro, Smeraldo and every other product stay as they are.
-- The catalogue switch (inStock: false in lib/products.ts) already blocks orders; this makes the live count agree.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

UPDATE wallet_inventory SET stock = 0 WHERE slug = 'wallet-rubino';

SELECT slug, stock FROM wallet_inventory WHERE slug LIKE 'wallet-%' ORDER BY slug;
