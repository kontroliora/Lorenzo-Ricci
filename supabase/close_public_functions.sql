-- Run AFTER the new code is live and a test order has gone through.
--
-- Closes the database functions the 2026-09-25 security audit found callable by
-- anyone holding the public key:
--   • reserve_wallet_stock / restock_wallet_stock — the public key could zero or
--     inflate any product's stock. Checkout and the Econt cron now use the server
--     key; the admin panel keeps access through the logged-in role.
--   • waitlist_issue_code (Dubai test, 5% never-expiring codes) — closed to the
--     public key and to logged-in accounts. Its only caller, /api/order-intl, is
--     closed in code as well (the Dubai code itself stays, dormant).
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

REVOKE EXECUTE ON FUNCTION reserve_wallet_stock(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION restock_wallet_stock(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION waitlist_issue_code(text)  FROM anon, authenticated;

-- Check: every "anon" row must be false; service_role must be true for the two
-- stock functions; authenticated true for the stock functions, false for the code one.
SELECT p.proname AS function, r.role,
       has_function_privilege(r.role, p.oid, 'EXECUTE') AS can_run
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role)
WHERE n.nspname = 'public'
  AND p.proname IN ('reserve_wallet_stock', 'restock_wallet_stock', 'waitlist_issue_code')
ORDER BY 1, 2;
