-- ============================================================================
-- Lorenzo Ricci — order exclusion flag (test / fake orders)
-- Orders flagged with excluded_from_stock = true are NEVER counted against
-- inventory (test orders, fraudulent customers, etc.).
-- Run in: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS excluded_from_stock boolean NOT NULL DEFAULT false;
