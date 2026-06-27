-- Newsletter subscribers table
-- Run in Supabase: Dashboard → SQL Editor → paste → Run
-- Safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE)

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        UNIQUE NOT NULL,
  promo_code    text        UNIQUE NOT NULL,
  code_used     boolean     DEFAULT false NOT NULL,
  subscribed_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast code lookups at checkout
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_promo_code
  ON newsletter_subscribers (promo_code);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon INSERT (new subscriber)
DROP POLICY IF EXISTS "anon_insert_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_insert_newsletter"
  ON newsletter_subscribers FOR INSERT TO anon WITH CHECK (true);

-- Anon UPDATE (mark code as used + upsert conflict resolution)
DROP POLICY IF EXISTS "anon_update_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_update_newsletter"
  ON newsletter_subscribers FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Anon SELECT (needed for PostgREST to resolve upsert + validate code)
DROP POLICY IF EXISTS "anon_select_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_select_newsletter"
  ON newsletter_subscribers FOR SELECT TO anon USING (true);
