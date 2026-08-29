-- 0004_transfers
-- Two-step stock movement between locations (brief §4.4). Created before
-- stock_movements so the ledger's transfer_id FK resolves.

create table transfers (
  id               uuid primary key default gen_random_uuid(),
  transfer_ref     text not null unique,        -- 'TRF-2026-0041', generated
  from_location_id uuid not null references locations(id),
  to_location_id   uuid not null references locations(id),
  status           text not null check (status in
                     ('dispatched','received','received_with_variance','cancelled')),
  dispatch_date    date not null,
  dispatched_by    uuid not null references profiles(id),
  dispatched_at    timestamptz not null default now(),
  receipt_date     date,
  received_by      uuid references profiles(id),
  received_at      timestamptz,
  order_number     text,
  notes            text,
  check (from_location_id <> to_location_id)
);

create table transfer_lines (
  id                 uuid primary key default gen_random_uuid(),
  transfer_id        uuid not null references transfers(id) on delete cascade,
  product_id         uuid not null references products(id),
  finish_id          uuid references finishes(id),
  variant_note       text,
  qty_dispatched     integer not null check (qty_dispatched > 0),
  qty_received       integer,                   -- null until receipt confirmed
  unit_selling_price numeric(12,2) not null,    -- stamped at dispatch
  unit_standard_cost numeric(12,2)
);

create index transfers_to_dispatched_idx on transfers (to_location_id) where status = 'dispatched';
create index transfers_status_idx on transfers (status);
create index transfer_lines_transfer_idx on transfer_lines (transfer_id);
