-- Panel "Изоставени колички": what the staff did after phoning a saved cart. Three new columns on cart_sessions:
--   call_state    null | 'will_order' (Звъннах - ще поръча) | 'declined' (не иска, the cart disappears) | 'no_answer' (Не вдига)
--   call_attempts how many times "Не вдига" was pressed (the cart disappears after 2)
--   last_call_at  when the last call was logged
-- Additive, safe to run more than once, nothing is deleted. The panel list itself works without this (it only needs the existing
-- phone column); the three call buttons need it.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.

ALTER TABLE cart_sessions
  ADD COLUMN IF NOT EXISTS call_state    text,
  ADD COLUMN IF NOT EXISTS call_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_call_at  timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_sessions_call_state_chk') THEN
    ALTER TABLE cart_sessions ADD CONSTRAINT cart_sessions_call_state_chk
      CHECK (call_state IS NULL OR call_state IN ('will_order', 'declined', 'no_answer'));
  END IF;
END $$;

-- Check: 3 rows
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'cart_sessions' AND column_name IN ('call_state','call_attempts','last_call_at');
