-- Run BEFORE the new code goes live (with the bags / Yachting / restock files).
--
-- Checkout now reserves stock with the server key (service_role) instead of the
-- public key. This makes sure that role can run the two stock functions — without
-- it, every order would be refused the moment the new code deploys. Safe to re-run.
--
-- Run in Supabase project xefgrsgijjrmctzezosg: Dashboard → SQL Editor → paste → Run.

GRANT EXECUTE ON FUNCTION reserve_wallet_stock(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION restock_wallet_stock(jsonb) TO service_role;

-- Both rows must say true.
SELECT p.proname AS function,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS server_key_can_run
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('reserve_wallet_stock', 'restock_wallet_stock')
ORDER BY 1;
