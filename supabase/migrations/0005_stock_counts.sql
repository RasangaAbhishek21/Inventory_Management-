-- 0005_stock_counts
-- Physical count sheets (brief §4.5). Created before stock_movements so the ledger's
-- stock_count_id FK resolves.

create table stock_counts (
  id            uuid primary key default gen_random_uuid(),
  count_ref     text not null unique,           -- 'CNT-2026-03-MAH', generated
  location_id   uuid not null references locations(id),
  count_date    date not null,
  status        text not null check (status in
                  ('open','submitted','posted','cancelled')),
  opened_by     uuid not null references profiles(id),
  opened_at     timestamptz not null default now(),
  submitted_by  uuid references profiles(id),
  submitted_at  timestamptz,
  posted_by     uuid references profiles(id),
  posted_at     timestamptz,
  notes         text
);

create table stock_count_lines (
  id                 uuid primary key default gen_random_uuid(),
  stock_count_id     uuid not null references stock_counts(id) on delete cascade,
  product_id         uuid not null references products(id),
  finish_id          uuid references finishes(id),
  system_qty         integer not null,          -- snapshotted when the count is opened
  counted_qty        integer,                   -- null until entered
  variance           integer generated always as (counted_qty - system_qty) stored,
  notes              text,
  unique (stock_count_id, product_id, finish_id)
);

-- Only one open OR submitted count per location at a time (brief §4.5 rules, test 22).
create unique index stock_counts_one_active_per_location
  on stock_counts (location_id)
  where status in ('open','submitted');

create index stock_count_lines_count_idx on stock_count_lines (stock_count_id);
