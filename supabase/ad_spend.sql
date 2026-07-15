-- Manual ad-spend ledger for the ROAS tab. The owner enters spend per period
-- (e.g. "7–14 July: €280"); the ROAS view pro-rates it by day-overlap onto the
-- selected window. Kept manual on purpose — one number a week beats fighting the
-- Meta API for a figure that takes 30 seconds to type.
create table if not exists ad_spend (
  id           uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end   date not null,
  amount       numeric(10,2) not null check (amount >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint ad_spend_range_ok check (period_end >= period_start)
);

-- Owner-only. RLS on with NO policies → denies anon + the employee outright.
-- All reads/writes go through isOwner-gated server actions using the service
-- role (which bypasses RLS). Defence in depth, same model as owner_revenue().
alter table ad_spend enable row level security;

create index if not exists ad_spend_period_idx on ad_spend (period_start, period_end);
