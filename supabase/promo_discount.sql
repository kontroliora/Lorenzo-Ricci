-- ============================================================================
-- Generalize the promo mechanism so a code can carry its OWN discount %.
--
-- Until now the discount was hardcoded 10% in /api/promo/validate AND in the
-- cart. Newsletter codes stay 10% (column default, so every existing code is
-- unchanged); the international "soft decline" apology codes are 5%.
--
-- Safe/additive: newsletter_get_or_create is left completely untouched. We only
-- add a column, teach promo_lookup to return it, and add a NEW issuer function.
-- ============================================================================

-- 1. Per-code discount. DEFAULT 0.10 → every already-issued code keeps 10%.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0.10;


-- 2. promo_lookup must surface the discount so /api/promo/validate can pass it
--    to the cart. Return type changes → DROP then CREATE (REPLACE can't widen it).
--    Old validate code that ignores the 4th column keeps working until redeployed.
-- Also surfaces expires_at (until now a DEAD column — nothing read it; validate
-- computed expiry from subscribed_at). We activate it as the authoritative
-- override: waitlist codes store 'infinity' (native Postgres "no end", no fake
-- date), newsletter codes keep expires_at NULL and fall back to the legacy
-- subscribed_at + 14-day rule — so their behaviour is unchanged.
DROP FUNCTION IF EXISTS promo_lookup(text);
CREATE FUNCTION promo_lookup(p_code text)
RETURNS TABLE (found boolean, code_used boolean, subscribed_at timestamptz, discount numeric, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (s.promo_code IS NOT NULL)   AS found,
    COALESCE(s.code_used, false) AS code_used,
    s.subscribed_at              AS subscribed_at,
    COALESCE(s.discount, 0.10)   AS discount,
    s.expires_at                 AS expires_at
  FROM (SELECT upper(trim(coalesce(p_code, ''))) AS code) q
  LEFT JOIN newsletter_subscribers s ON s.promo_code = q.code;
$$;


-- 3. Issuer for the 5% apology code. Mirrors newsletter_get_or_create's unique
--    LR-XXXXXX generation + collision retry, but issues at 5% — and if the email
--    already holds a code, returns THAT one as-is (keeps their existing discount,
--    which is >= 5%, so the customer is never worse off).
CREATE OR REPLACE FUNCTION waitlist_issue_code(p_email text)
RETURNS TABLE (out_promo_code text, out_discount numeric, out_is_new boolean)
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

  -- Already holds a code → return it untouched (never downgrade their discount).
  SELECT * INTO v_existing FROM newsletter_subscribers WHERE email = v_email;
  IF FOUND THEN
    out_promo_code := v_existing.promo_code;
    out_discount   := COALESCE(v_existing.discount, 0.10);
    out_is_new     := false;
    RETURN NEXT; RETURN;
  END IF;

  -- New → issue a fresh 5% code (retry on the rare code collision).
  FOR v_attempt IN 1..6 LOOP
    v_code := 'LR-';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    BEGIN
      -- expires_at = 'infinity' → the apology code never expires (the piece may be
      -- out of stock well beyond any fixed window). Native, honest — no fake date.
      INSERT INTO newsletter_subscribers (email, promo_code, code_used, discount, expires_at)
      VALUES (v_email, v_code, false, 0.05, 'infinity');
      out_promo_code := v_code;
      out_discount   := 0.05;
      out_is_new     := true;
      RETURN NEXT; RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Email race → return the winning row; else code collision → retry.
      SELECT * INTO v_existing FROM newsletter_subscribers WHERE email = v_email;
      IF FOUND THEN
        out_promo_code := v_existing.promo_code;
        out_discount   := COALESCE(v_existing.discount, 0.10);
        out_is_new     := false;
        RETURN NEXT; RETURN;
      END IF;
    END;
  END LOOP;
  RAISE EXCEPTION 'code_alloc_failed';
END;
$$;


-- 4. Grants (SECURITY DEFINER, called with the anon key like the other promo RPCs).
REVOKE ALL ON FUNCTION promo_lookup(text)         FROM public;
REVOKE ALL ON FUNCTION waitlist_issue_code(text)  FROM public;
GRANT EXECUTE ON FUNCTION promo_lookup(text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION waitlist_issue_code(text) TO anon, authenticated;
