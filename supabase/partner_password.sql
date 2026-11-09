-- ============================================================================
-- Partner password sign-in (owner, 09.11.2026). Safe to run more than once. Supabase project xefgrsgijjrmctzezosg.
-- The password is stored ONLY as a bcrypt hash (cost 12). The hash itself is not in this file (kept out of git): the owner
-- runs the UPDATE line he was given separately, right after this.
-- partners has RLS on and no policy for anon / authenticated (partner_role.sql): only the server can read the hash.
-- ============================================================================
ALTER TABLE partners ADD COLUMN IF NOT EXISTS password_hash text
  CHECK (password_hash IS NULL OR password_hash ~ '^\$2[aby]\$1[0-4]\$.{53}$');   -- bcrypt only: a plain password can never be saved

-- UPDATE partners SET password_hash = '<bcrypt hash>' WHERE email = 'dejvidvisev99@gmail.com';

-- check: has_password = true for him; the hash itself is not shown
SELECT email, enabled, password_hash IS NOT NULL AS has_password FROM partners ORDER BY created_at;
