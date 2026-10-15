-- Where customers get stuck in the checkout: one row each time the form refused to submit (validation: which fields), the server refused
-- the order (server: code + status) or the network failed. Written by /api/checkout-event with the service key; field NAMES only, no
-- personal data. Additive, safe to run more than once. Without this table the events still go to the Vercel logs ("[checkout-fail]").
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.

CREATE TABLE IF NOT EXISTS checkout_events (
  id          bigserial   PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  market      text        NOT NULL,            -- bg | ro
  kind        text        NOT NULL,            -- validation | server | network
  fields      text[]      NOT NULL DEFAULT '{}',
  code        text,
  status      integer,
  delivery    text,                            -- office | office-manual | home
  picker      text,                            -- BG Econt list: ready | loading | failed
  width       integer,                         -- browser width in px
  session_id  text,                            -- = cart_sessions.session_id of that visit
  ua          text
);
CREATE INDEX IF NOT EXISTS checkout_events_created_idx ON checkout_events (created_at DESC);

ALTER TABLE checkout_events ENABLE ROW LEVEL SECURITY;   -- no policies: the server (service role) only

-- Check: what stopped people in the last 24 hours
-- SELECT market, kind, unnest(fields) AS field, count(*) FROM checkout_events WHERE created_at > now() - interval '24 hours' GROUP BY 1,2,3 ORDER BY 4 DESC;
