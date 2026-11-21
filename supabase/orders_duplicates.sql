-- Повторни поръчки: "Не е дубликат" (owner marks a group of related orders as legitimate).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- The grouping itself is computed from the orders (lib/duplicate-orders.ts), nothing else is stored.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz;
-- cancel_category is plain text: the new value 'duplicate' (cancelled as a duplicate, no e-mail to the customer) needs no change.
