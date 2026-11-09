-- ============================================================================
-- RLS lockdown, PART 2 of 2: no login (authenticated) and no public key (anon) may read or write customer data directly.
-- Only the server (service role): the checkout / payment / e-mail / cron code, and the admin panel through its server code
-- (lib/supabase/admin-db.ts, after the admin_users check). Owner, 09.11.2026. Safe to run more than once.
--
-- RUN ONLY AFTER the site version with lib/supabase/admin-db.ts is live AND part 1 has run. Before that the panel still reads
-- orders with the admin's own login and would show empty lists.
-- ============================================================================

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'orders', 'order_status_log',                       -- customers: name, phone, e-mail, address, items, totals, history
    'cart_sessions',                                     -- abandoned carts: name, phone, e-mail, address
    'newsletter_subscribers',                            -- e-mails
    'checkout_events', 'email_events', 'client_errors', 'page_views', 'stripe_events',   -- logs (e-mails, IPs, payments)
    'partners', 'partner_order_state', 'partner_status_log',
    'health_status'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE NOTICE 'skip (no table): %', t; CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE 'dropped policy % on %', pol.policyname, t;
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Panel-only functions: the server calls them with the service role now (stock reserve/restock, "не вдига", owner turnover,
-- traffic). Nobody with a login or the public key may call them directly any more.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('reserve_wallet_stock', 'restock_wallet_stock', 'mark_no_answer', 'owner_revenue', 'owner_revenue_ro', 'traffic_summary')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    RAISE NOTICE 'service role only: %', fn.sig;
  END LOOP;
END $$;

-- Kept on purpose (no customer data): admin_users self-read (the panel checks who you are), wallet_inventory and
-- product_price_overrides public read (stock / prices shown on the site), promo_lookup / promo_mark_used /
-- newsletter_get_or_create for the site's server code.

-- ---------- checks -----------------------------------------------------------
-- 1. Expect: every table rls = true, and all four access columns false.
SELECT c.relname AS table, c.relrowsecurity AS rls,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_read, has_table_privilege('anon', c.oid, 'UPDATE') AS anon_write,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS login_read, has_table_privilege('authenticated', c.oid, 'UPDATE') AS login_write
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('orders','order_status_log','cart_sessions','newsletter_subscribers','checkout_events','email_events','client_errors',
                    'page_views','stripe_events','partners','partner_order_state','partner_status_log','health_status')
ORDER BY 1;

-- 2. Every policy still open to logins / the public key anywhere in public (expect only admin_users_self_read and the
--    public reads of wallet_inventory / product_price_overrides; anything else: tell Claude).
SELECT tablename, policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'public' AND (roles && ARRAY['anon','authenticated','public']::name[]) ORDER BY 1, 2;

-- 3. Logins WITHOUT an admin_users row: they are now refused by the panel (403). Expect none, or only accounts you do not use.
SELECT u.email, u.last_sign_in_at FROM auth.users u LEFT JOIN admin_users a ON a.user_id = u.id WHERE a.user_id IS NULL;
