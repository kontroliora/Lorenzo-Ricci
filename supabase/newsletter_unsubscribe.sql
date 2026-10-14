-- Newsletter unsubscribe: marks a subscriber as opted out.
-- PROJECT: xefgrsgijjrmctzezosg (kontroliora's Project, "main", PRODUCTION) - check the ref in the URL before running.
-- Run in Supabase: Dashboard -> SQL Editor -> paste -> Run. Safe to run more than once.
-- Campaign sends must filter:  WHERE unsubscribed_at IS NULL

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- Quick check after running (should return one row, column exists, 0 unsubscribed so far):
-- SELECT count(*) AS total, count(*) FILTER (WHERE unsubscribed_at IS NOT NULL) AS unsubscribed FROM newsletter_subscribers;
