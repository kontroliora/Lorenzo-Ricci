-- ============================================================================
-- Per-attempt call times: record the EXACT moment of EVERY "не вдига" press,
-- not just the last one. Lets the panel + audit show "опит 1: 10:15 · опит 2:
-- 18:30 · опит 3: 10:22 (следв. ден)" and lets the owner spot suspicious bursts
-- (e.g. 3 presses within 5 minutes instead of real calls in different windows).
--
-- Stored as a jsonb array of timestamps ON THE ORDER itself — reliable and
-- visible to owner AND employee, independent of the audit trigger.
--
-- Safe for existing data: adds a column with a '[]' default (existing orders are
-- untouched); their PAST attempts have no recorded times — we only ever kept the
-- last one — but every attempt FROM NOW ON is stamped. Idempotent, re-runnable.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS call_attempt_times jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Append now() to the array on every no-answer press (plus the existing counter
-- + last_attempt_at, unchanged).
CREATE OR REPLACE FUNCTION mark_no_answer(p_id bigint) RETURNS void
LANGUAGE sql AS $$
  UPDATE orders
     SET call_attempts      = call_attempts + 1,
         call_state         = 'no_answer',
         last_attempt_at    = now(),
         call_attempt_times = coalesce(call_attempt_times, '[]'::jsonb) || to_jsonb(now())
   WHERE id = p_id;
$$;
