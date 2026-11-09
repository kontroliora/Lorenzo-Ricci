-- ============================================================================
-- Remove koko@lorenzo-ricci.com from the admin panel (owner, 09.11.2026). Supabase project xefgrsgijjrmctzezosg.
-- 1. admin_users row deleted  -> the panel and /api/admin refuse him at once (middleware + adminDb check admin_users per request)
-- 2. his login BANNED (not deleted: the order history keeps his past entries, and it can be undone) -> no new sign-in, no token refresh
-- 3. his sessions + refresh tokens deleted -> signed out everywhere
-- The partner (dejvidvisev99@gmail.com) has no Supabase login and is not touched.
-- ============================================================================
DO $$
DECLARE uid uuid := (SELECT id FROM auth.users WHERE lower(email) = 'koko@lorenzo-ricci.com');
BEGIN
  IF uid IS NULL THEN RAISE NOTICE 'koko@lorenzo-ricci.com: no login found'; RETURN; END IF;
  DELETE FROM public.admin_users WHERE user_id = uid;
  UPDATE auth.users SET banned_until = 'infinity' WHERE id = uid;
  DELETE FROM auth.refresh_tokens WHERE user_id = uid::text;
  DELETE FROM auth.sessions WHERE user_id = uid;
  RAISE NOTICE 'koko@lorenzo-ricci.com removed from admin_users, banned, signed out';
END $$;

-- check 1: who may use the panel (expect ONLY sodolos3@gmail.com, owner)
SELECT u.email, a.role FROM public.admin_users a JOIN auth.users u ON u.id = a.user_id ORDER BY 1;

-- check 2: every Supabase login (expect sodolos3@gmail.com, and koko@ with banned_until = infinity and 0 sessions)
SELECT u.email, u.banned_until, u.last_sign_in_at,
       (SELECT count(*) FROM auth.sessions s WHERE s.user_id = u.id) AS sessions,
       EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id) AS panel_access
FROM auth.users u ORDER BY 1;
