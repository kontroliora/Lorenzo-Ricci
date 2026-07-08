-- ============================================================================
-- Manual orders ("Създай поръчка") + structured cancel reasons.
-- Run in Supabase → SQL Editor. Idempotent.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_manual       boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_category text;   -- refused | unreachable | wrong_number | other
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason   text;   -- detail / free text

-- Let authenticated admins INSERT orders (the manual create form). Only admins
-- have accounts, so WITH CHECK (true) is safe here.
DROP POLICY IF EXISTS orders_admin_insert ON orders;
CREATE POLICY orders_admin_insert ON orders FOR INSERT TO authenticated WITH CHECK (true);

-- Log manual order CREATION in the audit trail (the status trigger is UPDATE-only).
CREATE OR REPLACE FUNCTION log_order_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_manual THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'създадена ръчно', NEW.status, auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()), 1);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_log_order_insert ON orders;
CREATE TRIGGER trg_log_order_insert AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION log_order_insert();

-- Full audit trigger (all branches) + the new cancel-reason branch.
CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_email text;
BEGIN
  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF NEW.cancel_category IS DISTINCT FROM OLD.cancel_category AND NEW.cancel_category IS NOT NULL THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'причина за отказ', NEW.cancel_category || COALESCE(' · ' || NULLIF(NEW.cancel_reason,''), ''), auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF NEW.call_attempts IS DISTINCT FROM OLD.call_attempts THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'не вдига', 'опит #'||NEW.call_attempts, auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF NEW.call_notes IS DISTINCT FROM OLD.call_notes THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'коментар', COALESCE(NEW.call_notes,''), auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'тракинг №', COALESCE(NEW.tracking_number,''), auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF NEW.excluded_from_stock IS DISTINCT FROM OLD.excluded_from_stock THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'маркиране', CASE WHEN NEW.excluded_from_stock THEN 'фалшива/тестова' ELSE 'върната в реални' END, auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  IF (to_jsonb(NEW)->>'return_reviewed') IS DISTINCT FROM (to_jsonb(OLD)->>'return_reviewed') THEN
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'върната стока', CASE WHEN (to_jsonb(NEW)->>'return_reviewed')::boolean THEN 'прегледана' ELSE 'чака преглед' END, auth.uid(), v_email, (SELECT COUNT(*)+1 FROM order_status_log WHERE order_id=NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
