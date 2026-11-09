-- ============================================================================
-- Lorenzo Ricci - restricted PARTNER role (women's collection jewellery only). Owner, 09.11.2026.
-- Safe to run more than once. Run in Supabase project xefgrsgijjrmctzezosg: Dashboard -> SQL Editor -> paste -> Run.
--
-- The partner has NO Supabase Auth account: he signs in through the site (/partner, magic link e-mailed by the site,
-- 30-day signed cookie). So he can never use the public key + a login against the database (every table that is
-- open to "authenticated" stays closed to him). His data lives in the tables below, which have RLS ON and NO policy
-- for anon / authenticated: only the server (service role) reads or writes them, after its own partner checks.
-- The owner may read the audit log from a logged-in panel session.
-- ============================================================================

-- ---------- partners: who may use /partner (one toggle = enabled) -----------
CREATE TABLE IF NOT EXISTS partners (
  email          text PRIMARY KEY CHECK (email = lower(btrim(email))),
  name           text,
  enabled        boolean     NOT NULL DEFAULT true,
  notify         boolean     NOT NULL DEFAULT true,        -- gets the order e-mails
  revoked_before timestamptz,                               -- sessions issued before this are dead (set on disable)
  invited_at     timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partners FROM anon, authenticated;

-- ---------- partner_order_state: his status + note per order ----------------
-- Separate from orders.status: his "Отказано" never cancels the store's order (mixed orders hold watches too).
CREATE TABLE IF NOT EXISTS partner_order_state (
  order_ref   text PRIMARY KEY,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','confirmed','cancelled','no_answer')),
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);
ALTER TABLE partner_order_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_order_state FROM anon, authenticated;

-- ---------- partner_status_log: every change he makes (append-only) ---------
CREATE TABLE IF NOT EXISTS partner_status_log (
  id          bigserial PRIMARY KEY,
  order_ref   text        NOT NULL,
  old_status  text,
  new_status  text,
  old_note    text,
  new_note    text,
  email       text        NOT NULL,
  ip          text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_status_log_ref_idx ON partner_status_log (order_ref, changed_at DESC);
ALTER TABLE partner_status_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON partner_status_log FROM anon;
DROP POLICY IF EXISTS partner_status_log_owner_read ON partner_status_log;
CREATE POLICY partner_status_log_owner_read ON partner_status_log FOR SELECT TO authenticated USING (is_owner());
-- nobody may change or delete a log row (no UPDATE / DELETE policy; the server only inserts)

-- ---------- orders: the partner e-mail goes out once -------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_email_sent_at timestamptz;   -- claimed before sending: never twice
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_email_error   text;          -- last error after 3 tries (Telegram alert sent)

-- No back-fill: only the new-order path (/api/order) and the "paid" path (lib/payment-notify.ts) send it, once per order.
-- (A mass UPDATE here would also bump updated_at of every order through trg_enforce_tracking.)

-- ---------- check ------------------------------------------------------------
-- Expect: the three tables with rls = true; anon/authenticated without SELECT on partners / partner_order_state.
SELECT c.relname AS table, c.relrowsecurity AS rls,
       has_table_privilege('anon', c.oid, 'SELECT')          AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('partners','partner_order_state','partner_status_log');
