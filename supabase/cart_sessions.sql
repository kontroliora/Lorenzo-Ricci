-- Cart abandonment sessions table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cart_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      text        UNIQUE NOT NULL,
  email           text        NOT NULL,
  name            text,
  items           jsonb       NOT NULL DEFAULT '[]',
  subtotal        numeric     DEFAULT 0,
  recovery_consent boolean    DEFAULT true,
  status          text        DEFAULT 'pending'
                              CHECK (status IN ('pending', 'converted', 'emailed', 'opted_out')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  recovery_sent_at timestamptz,
  converted_at    timestamptz
);

-- Index for fast lookups of pending sessions
CREATE INDEX IF NOT EXISTS cart_sessions_status_idx  ON cart_sessions (status);
CREATE INDEX IF NOT EXISTS cart_sessions_email_idx   ON cart_sessions (email);
CREATE INDEX IF NOT EXISTS cart_sessions_created_idx ON cart_sessions (created_at DESC);

-- RLS
ALTER TABLE cart_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can insert & update (server-side API routes use anon key)
CREATE POLICY "anon_insert_session"  ON cart_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_session"  ON cart_sessions FOR UPDATE TO anon USING (true);
-- Anon cannot SELECT (admin endpoint checks password before querying)
CREATE POLICY "anon_no_select"       ON cart_sessions FOR SELECT TO anon USING (false);
