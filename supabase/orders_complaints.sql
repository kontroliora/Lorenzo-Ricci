-- ============================================================================
-- Рекламации — a DELIVERED parcel the customer sends back (defect / 14-day
-- withdrawal) and we give the money back. This is NOT the existing
-- returning/restocked flow (that one is a parcel never collected, where no
-- money ever changed hands): here the order stays `completed` — it really was
-- delivered and the Econt / Stripe trail must keep saying so — and the
-- рекламация is recorded on top of it, with its own amount.
--
-- The amount is SUBTRACTED from turnover by lib/revenue.ts (bucketed by
-- complaint_at in Europe/Sofia), so owner_revenue() itself is untouched.
--
-- Run in Supabase → SQL Editor. Idempotent, re-runnable.
-- ============================================================================

ALTER TABLE orders
  -- When the рекламация was registered in the panel. NOT NULL = this order has one.
  ADD COLUMN IF NOT EXISTS complaint_at           timestamptz,
  -- Why it came back, in Koko's / the owner's own words (free text).
  ADD COLUMN IF NOT EXISTS complaint_reason       text,
  -- Money given back, in the order's own currency (EUR for Bulgaria, RON for
  -- Romania — same unit as orders.total). Defaults to the goods part of the
  -- order when the panel is not told otherwise.
  ADD COLUMN IF NOT EXISTS complaint_amount       numeric,
  -- 'open'      — the goods / the refund are still being sorted out
  -- 'resolved'  — done: customer refunded (or replaced) and the case is closed
  -- 'rejected'  — рекламацията не е приета; the money stays with us
  ADD COLUMN IF NOT EXISTS complaint_state        text,
  ADD COLUMN IF NOT EXISTS complaint_resolved_at  timestamptz,
  -- Set the one time the returned goods were physically put back in stock
  -- (wallet_inventory +1). The idempotency key: a second press restocks nothing.
  ADD COLUMN IF NOT EXISTS complaint_restocked_at timestamptz;

-- The panel reads "every order with a рекламация" on every board load.
CREATE INDEX IF NOT EXISTS orders_complaint_at_idx
  ON orders (complaint_at DESC) WHERE complaint_at IS NOT NULL;

-- ── Audit trail ─────────────────────────────────────────────────────────────
-- Its own trigger (the big log_order_status_change() in orders_audit_full.sql
-- stays untouched), reading through to_jsonb so it can never break on a column
-- a database does not have yet.
CREATE OR REPLACE FUNCTION log_order_complaint_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_new   jsonb := to_jsonb(NEW);
  v_old   jsonb := to_jsonb(OLD);
  v_label text;
BEGIN
  IF (v_new->>'complaint_at')    IS NOT DISTINCT FROM (v_old->>'complaint_at')
     AND (v_new->>'complaint_state') IS NOT DISTINCT FROM (v_old->>'complaint_state')
     AND (v_new->>'complaint_restocked_at') IS NOT DISTINCT FROM (v_old->>'complaint_restocked_at') THEN
    RETURN NEW;
  END IF;

  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());

  v_label := CASE
    WHEN (v_new->>'complaint_at') IS NULL THEN 'махната'
    WHEN (v_old->>'complaint_at') IS NULL THEN
      'заведена' || COALESCE(' · ' || (v_new->>'complaint_amount'), '')
    WHEN (v_new->>'complaint_restocked_at') IS DISTINCT FROM (v_old->>'complaint_restocked_at')
         AND (v_new->>'complaint_restocked_at') IS NOT NULL THEN 'стоката е върната в наличност'
    ELSE COALESCE(v_new->>'complaint_state', 'променена')
  END;

  INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
  VALUES (NEW.id, 'рекламация', v_label, auth.uid(), v_email,
          (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_complaint ON orders;
CREATE TRIGGER trg_log_order_complaint
  AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION log_order_complaint_change();
