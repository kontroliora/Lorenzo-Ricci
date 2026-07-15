-- Auto-classify returned shipments into "uncollected" (never picked up, storage
-- expired → seller pays both legs) vs "refused" (customer came, inspected,
-- declined). Derived from Econt tracking events (dwell at the final office).
-- Run in Supabase SQL Editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS return_kind       text,     -- 'uncollected' | 'refused' | null(unknown)
  ADD COLUMN IF NOT EXISTS return_dwell_days numeric;  -- calendar days at the final office before returning
