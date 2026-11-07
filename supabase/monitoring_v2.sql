-- Monitoring v2 (08.11.2026): browser JS errors, Resend e-mail problems, and the ad's age for the 3-day ad rule.
-- Additive only: no existing column or row is changed. Safe to run more than once.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
-- Every new table: RLS on, NO policies -> only the server (service role) reads/writes.

-- ── Ad age (lib/ad-rule.ts: ads younger than 3 days are never red) ─────────────────────────────────────────────────────
ALTER TABLE meta_ads ADD COLUMN IF NOT EXISTS created_time timestamptz;

-- ── Browser JS errors (written by /api/client-error) ────────────────────────────────────────────────────────────────────
-- No personal data: the message is scrubbed (e-mails, numbers, URLs' query strings), the page is the path only, the browser is
-- "Chrome 130 / Android". At most 1000 full rows per day, then a 5% sample with weight 20. Rows older than 14 days are deleted
-- by /api/cron/health.
CREATE TABLE IF NOT EXISTS client_errors (
  id          bigserial   PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sig         text        NOT NULL,            -- hash of kind + message + file: "the same error"
  kind        text        NOT NULL,            -- error | rejection
  message     text        NOT NULL,
  source      text,                            -- file:line:col (same-origin scripts only)
  page        text        NOT NULL,            -- path, no query string
  area        text        NOT NULL DEFAULT 'page',   -- page | cart | checkout
  market      text        NOT NULL DEFAULT 'bg',     -- bg | ro
  browser     text,
  device      text,                            -- mobile | desktop
  weight      integer     NOT NULL DEFAULT 1   -- sampled rows stand for this many reports
);
CREATE INDEX IF NOT EXISTS client_errors_created_idx ON client_errors (created_at DESC);
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

-- ── Resend: bounced / failed / complained / delayed e-mails (written by /api/resend-webhook) ────────────────────────────
CREATE TABLE IF NOT EXISTS email_events (
  id          bigserial   PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  svix_id     text        UNIQUE,              -- Resend retries a delivery with the same id: stored once
  type        text        NOT NULL,            -- email.bounced | email.failed | email.complained | email.delivery_delayed
  email_id    text,
  recipient   text,                            -- masked: j***@gmail.com
  subject     text,
  reason      text
);
CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Check after running:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('client_errors','email_events');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'meta_ads' AND column_name = 'created_time';
