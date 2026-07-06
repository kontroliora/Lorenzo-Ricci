-- Add the 'returned' status (shipment came back / customer never took it).
-- Run in: Supabase Dashboard → SQL Editor → paste → Run.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
