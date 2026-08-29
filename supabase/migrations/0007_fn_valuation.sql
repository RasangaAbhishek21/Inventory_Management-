-- 0007_fn_valuation
-- Weighted-average unit value at a location for a (product, finish) (brief §6).
--
--   avg = SUM(quantity * unit_value) / SUM(quantity)   over every movement at that
--         location for that product+finish
--
-- NULLIF(sum,0) makes a zero balance return NULL instead of dividing by zero — the
-- caller (fn_stamp_movement_values) falls back to the product price in that case.
-- avg_cost is NULL when every contributing line has a null unit_standard_cost, so
-- reports can still count the gaps rather than treating missing cost as zero.

create or replace function fn_avg_unit_value(
  p_location uuid,
  p_product  uuid,
  p_finish   uuid
)
returns table (avg_selling numeric, avg_cost numeric)
language sql
stable
as $$
  select
    sum(m.quantity * m.unit_selling_price) / nullif(sum(m.quantity), 0)                as avg_selling,
    case
      when count(m.unit_standard_cost) = 0 then null
      else sum(m.quantity * coalesce(m.unit_standard_cost, 0)) / nullif(sum(m.quantity), 0)
    end                                                                                as avg_cost
  from stock_movements m
  where m.location_id = p_location
    and m.product_id  = p_product
    and m.finish_id is not distinct from p_finish
$$;
