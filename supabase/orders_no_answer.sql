-- ============================================================================
-- "Не вдига": atomic attempt counter + audit every press.
-- The button is never locked; each press increments atomically (no race) and
-- is written to the audit log with the exact time + who.
-- Run in: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- Supersedes the earlier audit trigger (adds the 'не вдига' branch).
-- ============================================================================

-- Atomic increment — no client-passed counter, so rapid presses can't race.
CREATE OR REPLACE FUNCTION mark_no_answer(p_id bigint) RETURNS void
LANGUAGE sql AS $$
  UPDATE orders SET call_attempts = call_attempts + 1, call_state = 'no_answer' WHERE id = p_id;
$$;

-- Audit trigger: status changes + comment edits + EACH 'не вдига' attempt.
CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_n     int;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), v_email, v_n);
  END IF;

  IF NEW.call_notes IS DISTINCT FROM OLD.call_notes THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'коментар', COALESCE(NEW.call_notes, ''), auth.uid(), v_email, v_n);
  END IF;

  IF NEW.call_attempts IS DISTINCT FROM OLD.call_attempts THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'не вдига', 'опит #' || NEW.call_attempts, auth.uid(), v_email, v_n);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
