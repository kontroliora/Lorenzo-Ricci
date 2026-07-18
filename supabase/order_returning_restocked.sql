-- ============================================================================
-- Split the single "returned" order status into two sub-statuses:
--   returning  — parcel is on its way back to us (was "returned")
--   restocked  — physically received by us; leather stock has been returned +1
--
-- Postgres gotcha: a newly ADDed enum value cannot be USED in the same
-- transaction. Supabase's SQL editor may wrap the script in one transaction, so
-- RUN STEP 1 ON ITS OWN FIRST (let it commit), THEN run STEP 2.
-- ============================================================================

-- ─── STEP 1 — run this alone first ──────────────────────────────────────────
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returning';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'restocked';


-- ─── STEP 2 — run after Step 1 has committed ────────────────────────────────
-- When the parcel entered "returning": set going forward (cron / manual mark) so
-- the cron only auto-restocks returns it saw start returning. NULL = the legacy
-- 14 → cron never auto-restocks them; Koko confirms each with the button.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS returning_at     timestamptz;
-- When we physically received it back (Econt deliveryTime, or button press). The
-- idempotency key: a second trigger (cron after button, or vice-versa) is blocked
-- while this is NOT NULL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restocked_at     timestamptz;
-- 'cron' | 'button' — how the restock transition was triggered (audit clarity).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restocked_source text;

-- Migrate the existing returns → returning, WITHOUT returning_at (so the cron
-- leaves them for Koko's manual button; we don't know which are physically here).
UPDATE orders SET status = 'returning' WHERE status = 'returned';
