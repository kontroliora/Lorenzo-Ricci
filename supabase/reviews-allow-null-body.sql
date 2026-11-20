-- Allow NULL body for rating-only reviews (import of clover bracelet reviews, 19.11.2026).
-- Safe to run multiple times. Run in Supabase Dashboard → SQL Editor before running
-- scripts/import-clover-reviews.mjs.
--
-- Why: the original schema required body NOT NULL ≥ 10 chars (designed for user form submissions).
-- Rating-only reviews (stars + name, no written text) are legitimate and shown on the site,
-- so body is now nullable. The form still requires a body because validateReviewInput() in
-- lib/user-reviews.ts enforces its own minimum independently of the DB constraint.

ALTER TABLE public.reviews ALTER COLUMN body DROP NOT NULL;

-- Drop the auto-named inline CHECK and replace it with an explicit one that allows NULL.
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_body_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_body_check
  CHECK (body IS NULL OR (char_length(btrim(body)) BETWEEN 10 AND 1000));

-- Verify
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'body';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.reviews'::regclass AND contype = 'c' AND conname LIKE '%body%';
