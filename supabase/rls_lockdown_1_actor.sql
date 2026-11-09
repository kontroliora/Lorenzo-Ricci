-- ============================================================================
-- RLS lockdown, PART 1 of 2: keep "who did it" when the panel writes with the service role. Owner, 09.11.2026.
-- Safe to run NOW (the current site keeps working the same) and more than once.
-- Supabase project xefgrsgijjrmctzezosg: Dashboard -> SQL Editor -> paste -> Run.
--
-- After the lockdown the admin panel no longer touches customer data with the admin's own login token; its server code uses
-- the service role and sends the admin's user id in the request header "x-lr-actor" (lib/supabase/admin-db.ts).
-- lr_actor_uid() = auth.uid() for a normal login, or that header for the SERVICE ROLE ONLY (a login or the public key can
-- never fake it: for them auth.uid() / the anon role decides, the header is ignored).
-- Every function in schema public that used auth.uid() (order history triggers, is_owner(), mark_no_answer, ...) is
-- re-created with lr_actor_uid() instead, from its LIVE definition, so order_status_log keeps the admin's e-mail and
-- owner_revenue() keeps answering only the owner.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lr_actor_uid() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v uuid := auth.uid();
  h text;
BEGIN
  IF v IS NOT NULL THEN RETURN v; END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR coalesce(current_setting('role', true), '') = 'service_role' THEN
    h := nullif(current_setting('request.headers', true), '')::json ->> 'x-lr-actor';
    IF h ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN h::uuid; END IF;
  END IF;
  RETURN NULL;
END $$;

-- Re-create every public function that calls auth.uid() with lr_actor_uid() (grants and owner are kept by CREATE OR REPLACE).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname <> 'lr_actor_uid' AND p.prosrc LIKE '%auth.uid()%'
  LOOP
    EXECUTE replace(pg_get_functiondef(f.oid), 'auth.uid()', 'public.lr_actor_uid()');
    RAISE NOTICE 'switched to lr_actor_uid(): %', f.proname;
  END LOOP;
END $$;

-- ---------- check ------------------------------------------------------------
-- Expect: every row "lr_actor_uid" = true and "still auth.uid()" = false (lr_actor_uid itself is not listed).
SELECT p.proname AS function,
       p.prosrc LIKE '%lr_actor_uid()%' AS lr_actor_uid,
       p.prosrc LIKE '%auth.uid()%'      AS "still auth.uid()"
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname <> 'lr_actor_uid' AND (p.prosrc LIKE '%lr_actor_uid()%' OR p.prosrc LIKE '%auth.uid()%')
ORDER BY 1;
