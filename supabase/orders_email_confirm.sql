-- ============================================================================
-- "Потвърдете поръчката си" e-mail for customers who do not answer the phone (18.11.2026).
--   confirm_email_sent_at — the e-mail went out (set ONCE, before Resend is called; a failed send clears it again)
--   email_confirmed_at    — the customer pressed "ПОТВЪРЖДАВАМ ПОРЪЧКАТА" (the order then becomes status 'confirmed',
--                           call_state 'confirmed', exactly like a phone confirmation, and leaves the call queue)
-- Nullable, no default: NULL = not done. Run in: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirm_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_confirmed_at    timestamptz;

-- The audit log gets a readable line when a customer confirms by e-mail (the status change itself is logged by the
-- existing trigger, with no admin e-mail, because nobody in the panel did it).
CREATE OR REPLACE FUNCTION log_order_email_confirm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_n int;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'имейл', 'потвърдена (имейл)', NULL, 'клиентът (линк в имейла)', v_n);
  END IF;
  IF NEW.confirm_email_sent_at IS NOT NULL AND OLD.confirm_email_sent_at IS NULL THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES (NEW.id, 'имейл', 'изпратен имейл за потвърждение', NULL, 'система', v_n);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_email_confirm ON orders;
CREATE TRIGGER trg_log_order_email_confirm
  AFTER UPDATE OF email_confirmed_at, confirm_email_sent_at ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_email_confirm();
