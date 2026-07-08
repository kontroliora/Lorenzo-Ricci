-- ============================================================================
-- Track when the last "не вдига" (no-answer) attempt happened, so the call
-- queue can show "последен опит преди Xч" for orders awaiting a re-call.
-- Updates mark_no_answer to record it. Run in Supabase → SQL Editor. Idempotent.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE OR REPLACE FUNCTION mark_no_answer(p_id bigint) RETURNS void
LANGUAGE sql AS $$
  UPDATE orders
     SET call_attempts   = call_attempts + 1,
         call_state      = 'no_answer',
         last_attempt_at = now()
   WHERE id = p_id;
$$;
