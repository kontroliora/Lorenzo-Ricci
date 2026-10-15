-- Language of the person: 'bg' or 'ro'. Filled from the site they come from (/ro = 'ro', everything else = 'bg').
-- Used so that every e-mail goes in the right language (see CLAUDE.md): a campaign template is chosen per lang, a Romanian
-- subscriber never gets a Bulgarian campaign (and the other way round), the abandoned-cart reminder is Romanian for /ro carts.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running. Additive, safe to run more than once;
-- every existing row keeps working (lang defaults to 'bg').

ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'bg';
ALTER TABLE orders                 ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'bg';
ALTER TABLE cart_sessions          ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'bg';

-- only the two languages (added once; re-running skips it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_subscribers_lang_chk') THEN
    ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_lang_chk CHECK (lang IN ('bg', 'ro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_lang_chk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_lang_chk CHECK (lang IN ('bg', 'ro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_sessions_lang_chk') THEN
    ALTER TABLE cart_sessions ADD CONSTRAINT cart_sessions_lang_chk CHECK (lang IN ('bg', 'ro'));
  END IF;
END $$;

-- Romanian orders so far (placed on /ro, ship_country = 'RO') and the subscribers who have such an order
UPDATE orders SET lang = 'ro' WHERE ship_country = 'RO' AND lang <> 'ro';
UPDATE newsletter_subscribers s SET lang = 'ro'
WHERE s.lang <> 'ro'
  AND EXISTS (SELECT 1 FROM orders o WHERE lower(o.email) = lower(s.email) AND o.ship_country = 'RO');

-- Check: both columns exist, and how many rows are Romanian
-- SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'lang' AND table_name IN ('orders','newsletter_subscribers','cart_sessions');  -- 3 rows
-- SELECT 'orders' AS t, lang, count(*) FROM orders GROUP BY lang UNION ALL SELECT 'subscribers', lang, count(*) FROM newsletter_subscribers GROUP BY lang;
