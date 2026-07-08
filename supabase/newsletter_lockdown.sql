-- ============================================================================
-- Newsletter GDPR lockdown — stop the anon key from reading/altering the whole
-- newsletter_subscribers table.
--
-- Before: anon had SELECT/UPDATE USING(true) → anyone with the public anon key
-- could dump every subscriber email + promo code, and burn any code.
-- After:  anon has NO direct table access. All access goes through three
-- SECURITY DEFINER functions that run as the table owner (bypass RLS) and
-- return ONLY the minimal fields for the one row in question.
--
-- RUN ORDER (zero downtime):
--   PART 1  — run NOW (creates the functions). Safe alongside the old policies.
--   [deploy the new app code that calls these functions]
--   PART 2  — run AFTER the deploy is live (drops the anon table policies).
-- Idempotent: safe to re-run.
-- ============================================================================


-- ─────────────────────────── PART 1 — run now ──────────────────────────────
-- Get-or-create a subscriber by email. One email = one code (never re-issues).
-- Returns the code, whether it's used, when it was created, and if it's brand new.
CREATE OR REPLACE FUNCTION newsletter_get_or_create(p_email text)
RETURNS TABLE (out_promo_code text, out_code_used boolean, out_subscribed_at timestamptz, out_is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_code     text;
  v_chars    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars
  v_i        int;
  v_attempt  int;
  v_existing newsletter_subscribers%ROWTYPE;
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Existing subscriber → return their code, never issue a new one.
  SELECT * INTO v_existing FROM newsletter_subscribers WHERE email = v_email;
  IF FOUND THEN
    out_promo_code := v_existing.promo_code;
    out_code_used := v_existing.code_used;
    out_subscribed_at := v_existing.subscribed_at;
    out_is_new := false;
    RETURN NEXT; RETURN;
  END IF;

  -- New subscriber → generate a unique LR-XXXXXX code and insert (retry on collision).
  FOR v_attempt IN 1..6 LOOP
    v_code := 'LR-';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    BEGIN
      INSERT INTO newsletter_subscribers (email, promo_code, code_used)
      VALUES (v_email, v_code, false)
      RETURNING subscribed_at INTO out_subscribed_at;
      out_promo_code := v_code;
      out_code_used := false;
      out_is_new := true;
      RETURN NEXT; RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Email race → return the row that won. Otherwise it's a code collision → retry.
      SELECT * INTO v_existing FROM newsletter_subscribers WHERE email = v_email;
      IF FOUND THEN
        out_promo_code := v_existing.promo_code;
        out_code_used := v_existing.code_used;
        out_subscribed_at := v_existing.subscribed_at;
        out_is_new := false;
        RETURN NEXT; RETURN;
      END IF;
    END;
  END LOOP;
  RAISE EXCEPTION 'code_alloc_failed';
END;
$$;

-- Look up a single promo code's status. Always returns exactly one row.
CREATE OR REPLACE FUNCTION promo_lookup(p_code text)
RETURNS TABLE (found boolean, code_used boolean, subscribed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (s.promo_code IS NOT NULL)       AS found,
    COALESCE(s.code_used, false)     AS code_used,
    s.subscribed_at                  AS subscribed_at
  FROM (SELECT upper(trim(coalesce(p_code, ''))) AS code) q
  LEFT JOIN newsletter_subscribers s ON s.promo_code = q.code;
$$;

-- Mark one code used (only if currently unused). Returns true if it flipped it.
CREATE OR REPLACE FUNCTION promo_mark_used(p_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  UPDATE newsletter_subscribers
     SET code_used = true
   WHERE promo_code = upper(trim(coalesce(p_code, ''))) AND code_used = false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

-- Only these three functions are callable by the public anon key.
REVOKE ALL ON FUNCTION newsletter_get_or_create(text) FROM public;
REVOKE ALL ON FUNCTION promo_lookup(text)             FROM public;
REVOKE ALL ON FUNCTION promo_mark_used(text)          FROM public;
GRANT EXECUTE ON FUNCTION newsletter_get_or_create(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION promo_lookup(text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION promo_mark_used(text)          TO anon, authenticated;


-- ──────────────── PART 2 — run only AFTER the new code is live ──────────────
-- Removes the anon key's direct table access. RLS stays ENABLED; with no anon
-- policies, the anon key can no longer read, insert, or update the table
-- directly — only through the three functions above.
DROP POLICY IF EXISTS "anon_select_newsletter" ON newsletter_subscribers;
DROP POLICY IF EXISTS "anon_update_newsletter" ON newsletter_subscribers;
DROP POLICY IF EXISTS "anon_insert_newsletter" ON newsletter_subscribers;
