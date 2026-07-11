-- ============================================================================
-- Shipment-notification bookkeeping. Three timestamps on orders so every email
-- is sent exactly once (idempotent — the cron guards on these being NULL).
--   shipped_at          — when Econt physically accepted the parcel (= sendTime)
--   ship_email_sent_at  — Email 1 ("изпратена") sent
--   reminder_sent_at    — Email 2 (single reminder) sent
-- Nullable, no default: NULL means "not done yet".
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipped_at         timestamptz,
  ADD COLUMN IF NOT EXISTS ship_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at   timestamptz;

-- Partial index: the cron only ever scans orders that still owe an email.
CREATE INDEX IF NOT EXISTS idx_orders_shipment_emails_pending
  ON orders (status)
  WHERE tracking_number IS NOT NULL
    AND (ship_email_sent_at IS NULL OR reminder_sent_at IS NULL);
