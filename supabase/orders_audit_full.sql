-- ============================================================================
-- Full audit trail: log EVERY change to an order as its own timestamped row.
-- Pure INSERTs (never overwrites/merges), so nothing is lost or combined.
-- Covers: status changes, each "не вдига" attempt, comment edits, tracking
-- number, fake/test toggle, and return-review flag. Owner-only (RLS unchanged).
-- Run in Supabase → SQL Editor. Idempotent (supersedes all earlier versions).
-- ============================================================================

CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email text;
BEGIN
  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), v_email,
            (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  -- Each "не вдига" press is its own row (call_attempts increments by 1).
  IF NEW.call_attempts IS DISTINCT FROM OLD.call_attempts THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'не вдига', 'опит #' || NEW.call_attempts, auth.uid(), v_email,
            (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  IF NEW.call_notes IS DISTINCT FROM OLD.call_notes THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'коментар', COALESCE(NEW.call_notes, ''), auth.uid(), v_email,
            (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'тракинг №', COALESCE(NEW.tracking_number, ''), auth.uid(), v_email,
            (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  IF NEW.excluded_from_stock IS DISTINCT FROM OLD.excluded_from_stock THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'маркиране',
            CASE WHEN NEW.excluded_from_stock THEN 'фалшива/тестова' ELSE 'върната в реални' END,
            auth.uid(), v_email, (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  -- return_reviewed may not exist yet — read via jsonb so the trigger never breaks.
  IF (to_jsonb(NEW)->>'return_reviewed') IS DISTINCT FROM (to_jsonb(OLD)->>'return_reviewed') THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'върната стока',
            CASE WHEN (to_jsonb(NEW)->>'return_reviewed')::boolean THEN 'прегледана' ELSE 'чака преглед' END,
            auth.uid(), v_email, (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
