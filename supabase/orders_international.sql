-- ============================================================================
-- International (Dubai test market) "soft decline" orders.
--
-- These orders NEVER enter the normal Econt / "за изпълнение" queue. The panel
-- excludes is_international from the live board in ONE place (the `real` filter,
-- same proven pattern as excluded_from_stock) and shows them in a separate
-- "Международни" view for manual follow-up. The Econt crons also skip them.
--
-- Additive only — the Bulgarian COD/Econt flow is untouched (default false).
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_international boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ship_country    text;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('is_international', 'ship_country');
