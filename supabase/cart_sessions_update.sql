-- Run this in Supabase SQL Editor
-- Adds phone, converted_at, recovery_sent_at columns to cart_sessions

ALTER TABLE cart_sessions
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS converted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz;

-- Make email nullable (previously required)
ALTER TABLE cart_sessions
  ALTER COLUMN email DROP NOT NULL;

-- Index for fast abandoned-cart lookups
CREATE INDEX IF NOT EXISTS idx_cart_sessions_abandoned
  ON cart_sessions (status, updated_at, recovery_sent_at)
  WHERE status = 'pending';
