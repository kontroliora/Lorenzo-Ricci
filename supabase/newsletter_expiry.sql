-- ============================================================================
-- Newsletter promo codes: 14-day validity — but ONLY for codes issued from the
-- rule start (2026-07-07 15:40 UTC) onward. Every code issued BEFORE that was
-- open-ended and is GRANDFATHERED (never expires) — we don't shorten codes
-- people already hold.
--
-- The app ENFORCES this in code (RULE_START in /api/newsletter + /api/promo).
-- This column is optional/informational — run it only if you want the expiry
-- (or "no expiry") visible in the table. Idempotent.
-- ============================================================================

ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE newsletter_subscribers
   SET expires_at = CASE
     WHEN subscribed_at >= '2026-07-07T15:40:00Z'
       THEN subscribed_at + interval '14 days'  -- new codes: 14-day validity
       ELSE NULL                                -- grandfathered: no expiry
   END;
