-- 2026 women's collection (lib/new-collection.ts) - the opening stock, read by the atomic reserve_wallet_stock() at order time.
-- Without a row a product is sold WITHOUT a cap, so run this BEFORE NEW_COLLECTION_LIVE goes to true.
--
--   clover necklaces  (Verdis, Noctis, Lumen × gold / silver)  6 × 200 = 1 200
--   clover bracelets  (Verdis, Noctis, Lumen × gold / silver)  6 × 200 = 1 200
--   bangles           (Linea, Solaris, Spira × gold / silver)  6 × 120 =   720
--                                                       18 products   3 120
--
-- Sets the stock even when a row already exists (ON CONFLICT ... DO UPDATE): these are the opening counts, and no order can have
-- taken any yet (the collection is hidden until NEW_COLLECTION_LIVE = true). Do NOT re-run after launch - it would overwrite the
-- live counts; change stock in the panel (Инвентар) from then on.
--
-- Pieces without photos (bracelet-lumen-gold, necklace-noctis-gold, bracelet-noctis-gold, bracelet-noctis-silver,
-- bracelet-verdis-gold) get their stock now but stay hidden until their photos are added (lib/new-collection.ts COLLECTION_PHOTOS).
--
-- NOT run yet. Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

BEGIN;

INSERT INTO wallet_inventory (slug, stock)
VALUES
  -- clover necklaces: 200 each
  ('necklace-verdis-gold',    200),
  ('necklace-verdis-silver',  200),
  ('necklace-noctis-gold',    200),
  ('necklace-noctis-silver',  200),
  ('necklace-lumen-gold',     200),
  ('necklace-lumen-silver',   200),
  -- clover bracelets: 200 each
  ('bracelet-verdis-gold',    200),
  ('bracelet-verdis-silver',  200),
  ('bracelet-noctis-gold',    200),
  ('bracelet-noctis-silver',  200),
  ('bracelet-lumen-gold',     200),
  ('bracelet-lumen-silver',   200),
  -- bangles: 120 each
  ('bracelet-linea-gold',     120),
  ('bracelet-linea-silver',   120),
  ('bracelet-solaris-gold',   120),
  ('bracelet-solaris-silver', 120),
  ('bracelet-spira-gold',     120),
  ('bracelet-spira-silver',   120)
ON CONFLICT (slug) DO UPDATE SET stock = EXCLUDED.stock;

-- Check: 18 rows, 3 120 pieces in total.
SELECT count(*) AS products, sum(stock) AS pieces
FROM wallet_inventory
WHERE slug ~ '^(necklace|bracelet)-(verdis|noctis|lumen|linea|solaris|spira)-(gold|silver)$';

COMMIT;

SELECT slug, stock FROM wallet_inventory
WHERE slug ~ '^(necklace|bracelet)-(verdis|noctis|lumen|linea|solaris|spira)-(gold|silver)$'
ORDER BY slug;
