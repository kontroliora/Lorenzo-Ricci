-- Durable price overrides for the owner's discount tool (lr-panel-v8m3q → Inventory
-- → −% / ↺). Previously the discount route rewrote lib/products.ts on disk
-- (fs.writeFileSync); on Vercel that file lives in a read-only/ephemeral serverless
-- container, so the write silently vanished on the next cold start or deploy —
-- the panel's "Не се записа" symptom. This table replaces that file write.
--
-- Row present for a slug  → that product is on sale (price = discounted, original_price
--                            = the pre-discount catalog price at the moment it was applied).
-- Row absent for a slug   → full catalog price from lib/products.ts, unchanged.
--
-- `slug` is the natural key already used everywhere (lib/products.ts getProductBySlug) —
-- there is no `products` table in this database (the catalog lives in code), so this
-- can't be a real foreign key; it only conceptually references that slug.
create table if not exists product_price_overrides (
  slug           text primary key,
  price          numeric(10,2) not null check (price > 0),
  original_price numeric(10,2) not null check (original_price > price),
  updated_at     timestamptz not null default now()
);

-- Public (storefront) needs to read these on every product/listing page to show the
-- live sale price. Only the admin discount route writes, via supabaseAdmin() (service
-- role, bypasses RLS) — no insert/update/delete policy for anon/authenticated, so a
-- browser client can never write a row of its own.
alter table product_price_overrides enable row level security;

create policy "public read" on product_price_overrides
  for select using (true);
