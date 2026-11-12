-- ============================================================================
-- Abandoned carts: a note per cart + who wrote it / who called last (owner, 12.11.2026). Safe to run more than once.
-- Supabase project xefgrsgijjrmctzezosg: Dashboard -> SQL Editor -> paste -> Run.
-- The partner (/partner -> Колички) and the panel share these: what one writes, the other sees. Needs cart_sessions_calls.sql.
-- ============================================================================
ALTER TABLE cart_sessions
  ADD COLUMN IF NOT EXISTS call_note    text,          -- what the customer said / what is missing (max 1000 chars, set by the app)
  ADD COLUMN IF NOT EXISTS call_note_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_note_by text,          -- 'партньор' or the admin's e-mail
  ADD COLUMN IF NOT EXISTS call_by      text;          -- who pressed the last call button (same values)

-- check: the 4 columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'cart_sessions' AND column_name IN ('call_note', 'call_note_at', 'call_note_by', 'call_by') ORDER BY 1;
