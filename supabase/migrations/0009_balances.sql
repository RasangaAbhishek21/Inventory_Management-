-- 0009_balances
-- Derived balances. There is no stored quantity_on_hand anywhere — everything is a
-- sum of the ledger (brief §4.3, §4.6).

create view v_stock_balances as
select
  m.location_id,
  m.product_id,
  m.finish_id,
  sum(m.quantity)                                             as qty_on_hand,
  sum(m.quantity * m.unit_selling_price)                      as value_at_selling_price,
  sum(m.quantity * coalesce(m.unit_standard_cost, 0))         as value_at_standard_cost,
  count(*) filter (where m.unit_standard_cost is null)        as lines_missing_cost
from stock_movements m
group by 1, 2, 3
having sum(m.quantity) <> 0;

-- As-at-date reporting. Every report calls this — the aggregation is not duplicated
-- in the application layer (brief §4.6). Filters on transaction_date (when it
-- physically happened), never entered_at (tests 13, 14).
create or replace function fn_stock_balances(
  as_at       date,
  p_location  uuid default null
)
returns table (
  location_id             uuid,
  product_id              uuid,
  finish_id               uuid,
  qty_on_hand             bigint,
  value_at_selling_price  numeric,
  value_at_standard_cost  numeric,
  lines_missing_cost      bigint
)
language sql
stable
as $$
  select
    m.location_id,
    m.product_id,
    m.finish_id,
    sum(m.quantity)::bigint,
    sum(m.quantity * m.unit_selling_price),
    sum(m.quantity * coalesce(m.unit_standard_cost, 0)),
    count(*) filter (where m.unit_standard_cost is null)::bigint
  from stock_movements m
  where m.transaction_date <= as_at
    and (p_location is null or m.location_id = p_location)
  group by m.location_id, m.product_id, m.finish_id
  having sum(m.quantity) <> 0
$$;
