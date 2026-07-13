-- Persist the promo/bonus code used on an order so the admin panel can show it.
-- Until now the code was received at checkout, used to mark the newsletter code
-- redeemed (promo_mark_used), but never stored on the order itself.
-- Run this in the Supabase SQL Editor. Only affects orders placed AFTER it runs.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code     text,
  ADD COLUMN IF NOT EXISTS promo_discount numeric;
