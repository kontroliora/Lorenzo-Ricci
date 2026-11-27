-- ============================================================================
-- Econt товарителници от панела (owner, 27.11.2026). Additive, safe to run more than once.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
--
-- 1. orders: the label columns + an index by label status (the "create for all confirmed" query).
-- 2. History: every change of econt_label_status is its own row in order_status_log, with WHO did it (lr_actor_uid(): the
--    admin's id from the x-lr-actor header). A SEPARATE trigger - the main log_order_status_change() is not touched.
-- Nothing is back-filled: existing orders start as 'none' (they were shipped with labels made by hand in Econt).
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_shipment_number  text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_label_pdf_url    text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_label_status     text NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_label_error      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_label_created_at timestamptz;
-- Which Econt account made it ('lr' | 'chronobg' | 'partner'): cancel / status always go to THAT account, even if the group's
-- account is switched later in "Подател по групи".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_label_account    text;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_econt_label_status_check
    CHECK (econt_label_status IN ('none','pending','created','error','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS orders_econt_label_status_idx ON orders (econt_label_status);

-- One Econt shipment can never sit on two orders.
CREATE UNIQUE INDEX IF NOT EXISTS orders_econt_shipment_number_uq ON orders (econt_shipment_number) WHERE econt_shipment_number IS NOT NULL;

-- ---------- history row per label status change -----------------------------
CREATE OR REPLACE FUNCTION log_econt_label_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := lr_actor_uid();
  v_email text := (SELECT email FROM auth.users WHERE id = v_uid);
  v_text  text;
BEGIN
  IF NEW.econt_label_status IS NOT DISTINCT FROM OLD.econt_label_status THEN RETURN NEW; END IF;
  IF NEW.econt_label_status = 'pending' THEN RETURN NEW; END IF;   -- the short lock is not history
  v_text := CASE NEW.econt_label_status
    WHEN 'created'   THEN 'създадена № ' || COALESCE(NEW.econt_shipment_number, '')
    WHEN 'error'     THEN 'грешка: ' || left(COALESCE(NEW.econt_label_error, ''), 300)
    WHEN 'cancelled' THEN 'анулирана № ' || COALESCE(OLD.econt_shipment_number, NEW.econt_shipment_number, '')
    ELSE NEW.econt_label_status END;
  INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
  VALUES (NEW.id, 'товарителница', v_text, v_uid, v_email,
          (SELECT COUNT(*) + 1 FROM order_status_log WHERE order_id = NEW.id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_econt_label ON orders;
CREATE TRIGGER trg_log_econt_label
  AFTER UPDATE OF econt_label_status ON orders FOR EACH ROW EXECUTE FUNCTION log_econt_label_change();

-- ---------- check ------------------------------------------------------------
-- Expect 6 rows (the new columns) and the trigger listed once.
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_name = 'orders' AND (column_name LIKE 'econt_label%' OR column_name = 'econt_shipment_number');
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_log_econt_label';
