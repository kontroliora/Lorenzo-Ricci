-- ============================================================================
-- Lorenzo Ricci — Orders call-center + audit
-- Reservation model: VARIANT A (computed). Vercel KV inventory is NOT touched;
-- "reserved" is derived from active order statuses (see lib/orders.ts).
-- Safe to run multiple times (idempotent).
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================================

-- ---------- ENUM types --------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('new','confirmed','shipped','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE call_state_t AS ENUM ('pending','confirmed','no_answer','refused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- orders: call-center columns --------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status          order_status;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_state      call_state_t NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_notes      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS call_attempts   int NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- Historical orders → 'completed' so they don't appear as new / count as reserved.
UPDATE orders SET status = 'completed' WHERE status IS NULL;
-- New orders from the site default to 'new' (which reserves stock, see app).
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;

-- Admin (authenticated session) needs to read + update orders. Anon insert
-- (public checkout) stays as-is; anon still cannot SELECT.
DROP POLICY IF EXISTS orders_auth_read   ON orders;
DROP POLICY IF EXISTS orders_auth_update ON orders;
CREATE POLICY orders_auth_read   ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY orders_auth_update ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------- admin_users: role mapping (owner vs employee) --------------------
CREATE TABLE IF NOT EXISTS admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'employee' CHECK (role IN ('owner','employee')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- Each admin may read only their own role row (so the app knows who they are).
DROP POLICY IF EXISTS admin_users_self_read ON admin_users;
CREATE POLICY admin_users_self_read ON admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Helper: is the current session an owner?
CREATE OR REPLACE FUNCTION is_owner() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

-- ---------- order_status_log: immutable audit trail (OWNER-ONLY) ------------
CREATE TABLE IF NOT EXISTS order_status_log (
  id               bigserial PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status       text,
  new_status       text,
  changed_by       uuid,
  changed_by_email text,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  change_number    int NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON order_status_log(order_id);
ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
-- Only the owner may read. No UPDATE/DELETE policies → nobody can alter it.
-- Rows are inserted only by the SECURITY DEFINER trigger below.
DROP POLICY IF EXISTS order_status_log_owner_read ON order_status_log;
CREATE POLICY order_status_log_owner_read ON order_status_log
  FOR SELECT TO authenticated USING (is_owner());

-- ---------- trigger: write an audit row on every status change --------------
CREATE OR REPLACE FUNCTION log_order_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_n     int;
  v_email text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COUNT(*) + 1 INTO v_n FROM order_status_log WHERE order_id = NEW.id;
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    INSERT INTO order_status_log
      (order_id, old_status, new_status, changed_by, changed_by_email, change_number)
    VALUES
      (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), v_email, v_n);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ---------- trigger: tracking number is MANDATORY for 'shipped' -------------
-- Enforced at the DB level → cannot be bypassed from the frontend.
CREATE OR REPLACE FUNCTION enforce_tracking_on_ship() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'shipped'
     AND (NEW.tracking_number IS NULL OR btrim(NEW.tracking_number) = '') THEN
    RAISE EXCEPTION 'Въведи тракинг номер от Еконт първо';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_tracking ON orders;
CREATE TRIGGER trg_enforce_tracking
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_tracking_on_ship();

-- ============================================================================
-- AFTER RUNNING THIS: mark your own account as owner (see instructions).
--   1) find your user id:   select id, email from auth.users order by created_at;
--   2) make yourself owner:  insert into admin_users(user_id, role)
--                            values ('<YOUR-UUID>', 'owner')
--                            on conflict (user_id) do update set role = 'owner';
--   3) mark the employee:    insert into admin_users(user_id, role)
--                            values ('<EMPLOYEE-UUID>', 'employee')
--                            on conflict (user_id) do update set role = 'employee';
-- ============================================================================
