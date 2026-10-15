-- Close the public (anonymous) INSERT on `orders`.
--
-- Why: anyone holding the public Supabase key (it is in the website's JavaScript) could write order rows straight into the
-- database - for example a row marked "paid by card", or a pending row with a huge quantity that the nightly sweep would then
-- "give back" to the stock. The checkout now saves orders with the SERVER's service-role key (app/api/order, app/api/order-intl),
-- so the public key does not need INSERT on `orders` any more.
--
-- RUN ORDER (important):
--   1. deploy the code of branch hotfix/orders-service-role to production,
--   2. place one cash-on-delivery order on the live site and check it appears in the panel,
--   3. only then run this script (before step 1 it would break checkout).
--
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL. Safe to run more than once.
-- The panel's "create manual order" form is not affected: it uses the logged-in role (policy orders_admin_insert).

-- 1. the panel's insert policy (also created by orders_manual_and_cancel.sql) - recreated so it certainly exists
DROP POLICY IF EXISTS orders_admin_insert ON public.orders;
CREATE POLICY orders_admin_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (true);

-- 2. drop every INSERT policy that applies to the anonymous / public role (the old checkout policy, whatever its name)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND cmd = 'INSERT'
      AND roles && ARRAY['anon', 'public']::name[]
      AND policyname <> 'orders_admin_insert'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.orders', p.policyname);
    RAISE NOTICE 'dropped insert policy: %', p.policyname;
  END LOOP;
END $$;

-- 3. and take the table privilege away from the public key as well (belt and braces)
REVOKE INSERT ON public.orders FROM anon;

-- Check: no INSERT policy may list anon or public; anon_can_insert must be false.
SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' ORDER BY cmd, policyname;
SELECT has_table_privilege('anon', 'public.orders', 'INSERT') AS anon_can_insert;
