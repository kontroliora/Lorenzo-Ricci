-- ============================================================================
-- Lorenzo Ricci - customer REVIEWS with moderation (Bulgarian shop, women's bracelets first). Owner, 17.11.2026.
-- Safe to run more than once. NOT RUN YET: run it in Supabase project xefgrsgijjrmctzezosg
-- (Dashboard -> SQL Editor -> paste -> Run) BEFORE the site version that reads it is deployed.
--
-- Rules (owner):
--   * Nothing is public until the owner approves it in the panel (status 'approved').
--   * The public (anon) may only INSERT a review as 'pending' and READ the 'approved' ones, and only the public columns:
--     the e-mail, the moderator, the moderation time and the IP hash are never readable with the public key.
--   * Only a panel admin (a row in admin_users) can change the status / text, delete, or flag a partnership review.
--     The panel does it through its server code (service role, lib/supabase/admin-db.ts), like the rest of the panel.
-- The site's own form posts to /api/product-review (honeypot, 3 reviews per IP per hour, full server validation, photo
-- check + re-encode) and writes with the service role. The public INSERT policy below is the database's own last line
-- of defence: even a direct call with the public key can only create a 'pending', non-partnership review that passes the
-- same CHECK limits.
-- ============================================================================

-- ---------- reviews -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug   text        NOT NULL CHECK (char_length(product_slug) BETWEEN 1 AND 120),
  name           text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  rating         smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           text        NOT NULL CHECK (char_length(btrim(body)) BETWEEN 10 AND 1000),
  images         text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(images) <= 3),   -- paths in the public bucket "review-images"
  email          text        CHECK (email IS NULL OR (char_length(email) <= 254 AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_partnership boolean     NOT NULL DEFAULT false,                                    -- shows the "Партньорство" label on the site
  created_at     timestamptz NOT NULL DEFAULT now(),
  moderated_at   timestamptz,
  moderated_by   text,                                                                  -- e-mail of the admin who approved / rejected it
  ip_hash        text                                                                   -- salted SHA-256 of the sender's IP (rate limit); never the IP itself
);

CREATE INDEX IF NOT EXISTS reviews_product_status_idx ON public.reviews (product_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_status_idx         ON public.reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_ip_idx             ON public.reviews (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Table privileges: start from nothing, then give exactly what each role needs.
REVOKE ALL ON public.reviews FROM anon, authenticated;
-- public: read ONLY these columns (no email, no moderator, no ip_hash) ...
GRANT SELECT (id, product_slug, name, rating, body, images, status, is_partnership, created_at) ON public.reviews TO anon;
-- ... and write ONLY these columns (is_partnership, moderated_*, ip_hash stay at their defaults / NULL).
GRANT INSERT (product_slug, name, rating, body, images, email, status) ON public.reviews TO anon;
-- panel admin with his own login: everything but creating rows (the policy below limits it to admin_users).
GRANT SELECT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

DROP POLICY IF EXISTS reviews_public_read   ON public.reviews;
DROP POLICY IF EXISTS reviews_public_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_admin_all     ON public.reviews;

CREATE POLICY reviews_public_read   ON public.reviews FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY reviews_public_insert ON public.reviews FOR INSERT TO anon WITH CHECK (status = 'pending' AND is_partnership = false AND moderated_at IS NULL AND moderated_by IS NULL);
CREATE POLICY reviews_admin_all     ON public.reviews FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

-- ---------- review_audit_log: who approved / rejected / changed what, and when (append-only) ----------
-- actor_role tells the owner's actions from an employee's (admin_users.role); actor_email tells people with the same role apart.
CREATE TABLE IF NOT EXISTS public.review_audit_log (
  id           bigserial   PRIMARY KEY,
  review_id    uuid        NOT NULL,                       -- no foreign key: the line stays when the review is deleted
  product_slug text,
  review_name  text,                                       -- who wrote it (snapshot, readable after a delete)
  action       text        NOT NULL CHECK (action IN ('approved', 'rejected', 'edited', 'partnership_on', 'partnership_off', 'deleted')),
  old_status   text,
  new_status   text,
  details      jsonb,                                      -- 'edited': {"old_body": ..., "new_body": ...}
  actor_id     uuid,
  actor_email  text,
  actor_role   text        CHECK (actor_role IN ('owner', 'employee')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_audit_log_review_idx ON public.review_audit_log (review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_audit_log_time_idx   ON public.review_audit_log (created_at DESC);

ALTER TABLE public.review_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_audit_log FROM anon, authenticated;
GRANT SELECT ON public.review_audit_log TO authenticated;
GRANT ALL ON public.review_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.review_audit_log_id_seq TO service_role;
DROP POLICY IF EXISTS review_audit_owner_read ON public.review_audit_log;
CREATE POLICY review_audit_owner_read ON public.review_audit_log FOR SELECT TO authenticated USING (is_owner());
-- nobody may change or delete a log row (no UPDATE / DELETE policy; the server only inserts)

-- ---------- storage: review photos ------------------------------------------
-- A public bucket: the site shows approved photos straight from it. Files are named with random ids (<review uuid>/<random>.webp),
-- the bucket has NO policy for anon / authenticated (nobody can list, upload or delete with a key); only the server writes (service role).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-images', 'review-images', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

-- ---------- checks -----------------------------------------------------------
-- 1. Expect: reviews + review_audit_log rls = true; anon_select true on reviews only through columns (no email), anon cannot read the log.
SELECT c.relname AS "table", c.relrowsecurity AS rls,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_table_select,
       has_column_privilege('anon', c.oid, 'email', 'SELECT') AS anon_can_read_email,
       has_column_privilege('anon', c.oid, 'body', 'SELECT')  AS anon_can_read_body
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('reviews', 'review_audit_log');
-- 2. Expect exactly: reviews_public_read (anon, SELECT), reviews_public_insert (anon, INSERT), reviews_admin_all (authenticated, ALL),
--    review_audit_owner_read (authenticated, SELECT).
SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('reviews', 'review_audit_log') ORDER BY 1, 2;
