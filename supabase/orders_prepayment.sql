-- Record whether an order was subject to the prepayment rule (price >= 1500 EUR
-- base price => cash-on-delivery hidden at checkout, card/bank transfer only).
-- The rule itself is enforced client-side today (lib/price.ts requiresPrepayment(),
-- read by components/cart/CheckoutForm.tsx) purely from each item's EUR price —
-- this column does NOT drive that gating, it only persists what applied to a given
-- order at the time it was placed, so the admin panel / audit trail stays correct
-- even if PREPAYMENT_THRESHOLD_EUR changes later.
-- Run this in the Supabase SQL Editor. Only affects orders placed AFTER it runs.
--
-- NOT WIRED YET: nothing currently writes this column — app/api/order/route.ts
-- (the order-creation endpoint) would need an insert-time computation, and that
-- file already has unrelated, uncommitted changes pending from the inventory
-- unification work-in-progress. Confirm you want that file touched before I wire
-- this in, so the two changes don't get tangled together in one diff.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS requires_prepayment boolean NOT NULL DEFAULT false;
