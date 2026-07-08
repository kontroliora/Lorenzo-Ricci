-- ============================================================================
-- Returns workflow: track whether a returned parcel's stock has been physically
-- reviewed and put back in the shelf ("прегледана") or still awaits review
-- ("чака преглед"). Purely a workflow flag — it does NOT change the inventory
-- calculation. Run in Supabase → SQL Editor. Idempotent.
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reviewed boolean NOT NULL DEFAULT false;

-- Existing returns are already processed → mark them reviewed so they don't
-- show up as "awaiting review". New returns start as false (чака преглед).
UPDATE orders SET return_reviewed = true WHERE status = 'returned';
