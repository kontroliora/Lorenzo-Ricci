-- Card discount: 5% off the goods when paying by card, at most EUR 25 / 130 lei per order (lib/card-discount.ts).
-- The amount is stored on the order so the panel and the e-mails can show it: orders.total already includes it
-- (total = subtotal - card_discount + shipping_cost). Additive and safe to run more than once; nothing is changed or deleted.
-- Without it orders are still taken (subtotal / total carry the amounts); only the separate "Отстъпка карта" line is missing.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_discount numeric;

-- Check: one row, column exists
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'card_discount';
