-- 2026 women's collection (lib/new-collection.ts) - wallet_inventory rows at 0, read by the atomic reserve_wallet_stock() at
-- order time. Without a row a product is sold WITHOUT a cap, so run this BEFORE NEW_COLLECTION_LIVE goes to true; then enter the
-- real counts in the panel (Инвентар). Safe to re-run: ON CONFLICT DO NOTHING never overwrites a row that already exists.
--
-- NOT run yet. Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

INSERT INTO wallet_inventory (slug, stock)
VALUES
  ('necklace-verdis-gold',   0),
  ('necklace-verdis-silver', 0),
  ('bracelet-verdis-gold',   0),
  ('bracelet-verdis-silver', 0),
  ('necklace-noctis-gold',   0),
  ('necklace-noctis-silver', 0),
  ('bracelet-noctis-gold',   0),
  ('bracelet-noctis-silver', 0),
  ('necklace-lumen-gold',    0),
  ('necklace-lumen-silver',  0),
  ('bracelet-lumen-silver',  0),
  ('bracelet-linea-gold',    0),
  ('bracelet-linea-silver',  0),
  ('bracelet-solaris-gold',  0),
  ('bracelet-solaris-silver', 0),
  ('bracelet-spira-gold',    0),
  ('bracelet-spira-silver',  0)
ON CONFLICT (slug) DO NOTHING;

SELECT slug, stock FROM wallet_inventory
WHERE slug ~ '^(necklace|bracelet)-(verdis|noctis|lumen|linea|solaris|spira)-(gold|silver)$'
ORDER BY slug;
