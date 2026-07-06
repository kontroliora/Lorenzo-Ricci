-- ============================================================================
-- Extend the order audit trigger to also log comment (call_notes) changes.
-- Every note edit is recorded (who + when), same as status changes.
-- Run in: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_n     int;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Status change (потвърди / изпратена / завършена / отказана / върната …)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log
      (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES
      (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), v_email, v_n);
  END IF;

  -- Comment change (added / edited at any stage)
  IF NEW.call_notes IS DISTINCT FROM OLD.call_notes THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log
      (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES
      (NEW.id, 'коментар', COALESCE(NEW.call_notes, ''), auth.uid(), v_email, v_n);
  END IF;

  RETURN NEW;
END; $$;

-- Fire on any update now (function itself decides what to log).
DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
