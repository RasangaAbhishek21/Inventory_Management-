-- 0006_stock_movements
-- THE append-only ledger (brief §4.3). Balances are always derived by summing this
-- table. There is no quantity_on_hand column here or anywhere, and none may be added.
--
-- Sign convention: quantity is POSITIVE when stock enters the location, NEGATIVE when
-- it leaves. Never an unsigned quantity with a separate direction flag.
--
-- Immutability: UPDATE and DELETE are revoked from application roles in 0019 and blocked
-- by a trigger in 0008. A mistake is corrected by inserting a reversing movement with
-- reverses_movement_id set.

create table stock_movements (
  id                  bigint generated always as identity primary key,
  movement_type       text not null check (movement_type in
                        ('opening','origination','transfer_out','transfer_in',
                         'dispatch','return','adjustment')),
  location_id         uuid not null references locations(id),
  product_id          uuid not null references products(id),
  finish_id           uuid references finishes(id),
  variant_note        text,                     -- free text: 'custom 1200mm width'
  quantity            integer not null check (quantity <> 0),  -- signed
  unit_selling_price  numeric(12,2) not null,   -- stamped, never looked up live
  unit_standard_cost  numeric(12,2),            -- stamped, never looked up live
  transaction_date    date not null,            -- when it physically happened
  entered_at          timestamptz not null default now(),
  entered_by          uuid not null references profiles(id),
  transfer_id         uuid references transfers(id),
  stock_count_id      uuid references stock_counts(id),
  order_number        text,
  reason_id           uuid references adjustment_reasons(id),
  notes               text,
  reverses_movement_id bigint references stock_movements(id),
  created_at          timestamptz not null default now(),

  -- brief §5.4: an adjustment always carries a reason
  constraint adjustment_needs_reason
    check (movement_type <> 'adjustment' or reason_id is not null)
);

create index stock_movements_balance_idx
  on stock_movements (location_id, product_id, finish_id, transaction_date);
create index stock_movements_txn_date_idx on stock_movements (transaction_date);
create index stock_movements_transfer_idx on stock_movements (transfer_id);
create index stock_movements_count_idx on stock_movements (stock_count_id);
create index stock_movements_type_date_idx on stock_movements (movement_type, transaction_date);
