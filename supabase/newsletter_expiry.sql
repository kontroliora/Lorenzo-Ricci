-- ============================================================================
-- Newsletter promo codes: 14-day validity + explicit stored expiry.
-- The app logic computes expiry as subscribed_at + 14 days (resilient), so
-- signup keeps working even before this runs. This column just stores it too.
-- Run in: Supabase → SQL Editor → paste → Run. Idempotent.
-- ============================================================================

-- New rows auto-get expiry 14 days out (route doesn't need to set it).
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '14 days');

-- Existing codes expire 14 days after they were created (not from migration time).
UPDATE newsletter_subscribers
   SET expires_at = subscribed_at + interval '14 days';
