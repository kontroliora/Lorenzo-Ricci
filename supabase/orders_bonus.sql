-- ============================================================================
-- Employee bonus: 2.50 € per SUCCESSFULLY DELIVERED (taken) parcel.
-- Tamper-proof: the bonus counts ONLY completions that came from Econt
-- ('completed_source' = 'econt'), never a manual click. Manual completions are
-- recorded as 'manual' and do NOT earn a bonus.
-- Run in: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at     timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_source text
  CHECK (completed_source IN ('econt','manual'));

-- Existing 'completed' orders were marked BY HAND → tag them 'manual' so they
-- never count toward the bonus. Real bonus starts only once Econt confirms
-- deliveries automatically (sets completed_source = 'econt').
UPDATE orders
   SET completed_source = 'manual',
       completed_at      = COALESCE(completed_at, created_at)
 WHERE status = 'completed' AND completed_source IS NULL;
