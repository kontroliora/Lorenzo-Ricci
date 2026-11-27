-- ============================================================================
-- Подател по групи за Еконт товарителниците (owner, 27.11.2026). Safe to run more than once.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
--
-- One row per group of orders; the label of an order takes the sender of ITS group (lib/econt-shipping.ts):
--   main           - every order that is NOT women's-jewellery-only (mixed orders too)  -> Коко, Еконт София Княжево (1164)
--   womens_jewelry - women's-jewellery-only orders                                       -> Павел, Еконт Бургас Роял (8020)
--   chronobg       - CHRONOBG orders (always the CHRONOBG Econt account)                 -> office not set yet
-- No office / name / phone = the label is an error "Няма зададен подател за тази група". Never a fallback to another group.
-- sender_name / sender_phone = the person who hands the parcel over (Econt "упълномощено лице"); the company itself comes from
-- the Econt account's profile. The owner fills / changes them in the panel ("Подател по групи"); every change is logged.
-- Column `sender_group` (not `group`: GROUP is an SQL keyword).
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipping_senders (
  sender_group       text PRIMARY KEY CHECK (sender_group IN ('main','womens_jewelry','chronobg')),
  econt_office_code  text,
  sender_name        text,
  sender_phone       text,
  econt_account      text NOT NULL DEFAULT 'lr' CHECK (econt_account IN ('lr','chronobg','partner')),
  updated_by         text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- CHRONOBG parcels always go from the CHRONOBG account, and only they do.
  CONSTRAINT shipping_senders_chronobg_account CHECK ((sender_group = 'chronobg') = (econt_account = 'chronobg'))
);
ALTER TABLE shipping_senders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shipping_senders FROM anon, authenticated;   -- only the server (service role), after its owner check

-- Seed: offices confirmed by the owner; names / phones are filled in the panel (empty = labels of that group stop with an error).
INSERT INTO shipping_senders (sender_group, econt_office_code, sender_name, sender_phone, econt_account, updated_by) VALUES
  ('main',           '1164', NULL, NULL, 'lr',       'migration'),
  ('womens_jewelry', '8020', NULL, NULL, 'lr',       'migration'),
  ('chronobg',       NULL,   NULL, NULL, 'chronobg', 'migration')
ON CONFLICT (sender_group) DO NOTHING;

-- ---------- audit: every change is its own row, with WHO (lr_actor_uid() = the admin of the x-lr-actor header) ----------
CREATE TABLE IF NOT EXISTS shipping_senders_log (
  id                bigserial PRIMARY KEY,
  sender_group      text        NOT NULL,
  old_row           jsonb,
  new_row           jsonb,
  changed_by        uuid,
  changed_by_email  text,
  changed_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shipping_senders_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shipping_senders_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION log_shipping_sender_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := lr_actor_uid();
  v_email text := (SELECT email FROM auth.users WHERE id = v_uid);
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(v_email, NEW.updated_by);
  INSERT INTO shipping_senders_log (sender_group, old_row, new_row, changed_by, changed_by_email)
  VALUES (NEW.sender_group, CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW), v_uid, COALESCE(v_email, NEW.updated_by));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_shipping_sender ON shipping_senders;
CREATE TRIGGER trg_log_shipping_sender
  BEFORE INSERT OR UPDATE ON shipping_senders FOR EACH ROW EXECUTE FUNCTION log_shipping_sender_change();

-- ---------- check ------------------------------------------------------------
SELECT sender_group, econt_office_code, sender_name, sender_phone, econt_account, updated_by FROM shipping_senders ORDER BY 1;
