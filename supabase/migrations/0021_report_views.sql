-- 0021_report_views
-- Views behind the reports (brief §8.10). Role gating for reports is done in the route
-- handlers (staff do not run reports, brief §7) — there is no per-app-role DB role to
-- gate on here; RLS on the underlying tables still applies to the movement rows.

-- In transit: dispatched transfers not yet fully received (brief §8.10).
create view v_in_transit as
select
  t.id,
  t.transfer_ref,
  t.from_location_id,
  fl.name as from_location,
  t.to_location_id,
  tol.name as to_location,
  t.dispatch_date,
  t.dispatched_at,
  t.dispatched_by,
  dp.full_name as dispatched_by_name,
  round(extract(epoch from (now() - t.dispatched_at)) / 3600.0, 1) as age_hours,
  (select count(*) from transfer_lines x where x.transfer_id = t.id) as line_count,
  (select coalesce(sum((x.qty_dispatched - coalesce(x.qty_received, 0)) * x.unit_selling_price), 0)
     from transfer_lines x where x.transfer_id = t.id) as value_at_selling_price
from transfers t
join locations fl on fl.id = t.from_location_id
join locations tol on tol.id = t.to_location_id
join profiles dp on dp.id = t.dispatched_by
where t.status = 'dispatched';

-- Open variances: received-with-variance transfers with no offsetting adjustment yet
-- (brief §8.9). A resolving adjustment carries the transfer_id.
create view v_open_variances as
select
  t.id as transfer_id,
  t.transfer_ref,
  t.to_location_id,
  l.name as to_location,
  t.receipt_date,
  tl.id as line_id,
  tl.product_id,
  pr.name as product,
  tl.finish_id,
  tl.qty_dispatched,
  coalesce(tl.qty_received, 0) as qty_received,
  (tl.qty_dispatched - coalesce(tl.qty_received, 0)) as shortfall,
  tl.unit_selling_price,
  (tl.qty_dispatched - coalesce(tl.qty_received, 0)) * tl.unit_selling_price as shortfall_value
from transfers t
join transfer_lines tl on tl.transfer_id = t.id
join products pr on pr.id = tl.product_id
join locations l on l.id = t.to_location_id
where t.status = 'received_with_variance'
  and (tl.qty_dispatched - coalesce(tl.qty_received, 0)) <> 0
  and not exists (
    select 1 from stock_movements m
    where m.transfer_id = t.id and m.movement_type = 'adjustment'
  );

-- Adjustment exceptions: adjustments over the §5.5 thresholds, for the monthly report
-- visible to finance / admin.
create view v_adjustment_exceptions as
select
  m.id,
  m.transaction_date,
  date_trunc('month', m.transaction_date)::date as month,
  m.location_id,
  l.name as location,
  m.product_id,
  pr.name as product,
  m.finish_id,
  m.quantity,
  m.unit_selling_price,
  abs(m.quantity * m.unit_selling_price) as abs_value_at_selling_price,
  m.reason_id,
  r.label as reason,
  m.notes,
  m.entered_by,
  ep.full_name as entered_by_name,
  m.entered_at
from stock_movements m
join locations l on l.id = m.location_id
join products pr on pr.id = m.product_id
left join adjustment_reasons r on r.id = m.reason_id
join profiles ep on ep.id = m.entered_by
where m.movement_type = 'adjustment'
  and (
    abs(m.quantity) >= fn_config_int('ADJ_QTY_EXCEPTION')
    or abs(m.quantity * m.unit_selling_price) >= fn_config_int('ADJ_VALUE_EXCEPTION')
  );

-- Stock accuracy: the Operations Manager's standing number (brief §8.10, §12), by
-- location and month over posted counts.
create view v_stock_accuracy as
with per_count as (
  select
    sc.id,
    sc.location_id,
    date_trunc('month', sc.count_date)::date as month,
    count(scl.id) as lines_counted,
    count(scl.id) filter (where scl.variance = 0) as lines_zero_variance,
    coalesce(sum(abs(scl.variance)), 0) as abs_unit_variance,
    coalesce(sum(scl.system_qty), 0) as system_units,
    coalesce(sum(scl.variance) filter (where scl.variance > 0), 0) as units_over,
    coalesce(sum(scl.variance) filter (where scl.variance < 0), 0) as units_short
  from stock_counts sc
  join stock_count_lines scl on scl.stock_count_id = sc.id
  where sc.status = 'posted'
  group by sc.id, sc.location_id, sc.count_date
),
impact as (
  select stock_count_id, sum(quantity * unit_selling_price) as net_value_impact
  from stock_movements
  where stock_count_id is not null
  group by stock_count_id
)
select
  pc.location_id,
  loc.name as location,
  pc.month,
  sum(pc.lines_counted) as lines_counted,
  sum(pc.lines_zero_variance) as lines_zero_variance,
  round(sum(pc.lines_zero_variance)::numeric / nullif(sum(pc.lines_counted), 0), 4) as line_accuracy,
  case
    when sum(pc.system_units) = 0 then null
    else round(1 - sum(pc.abs_unit_variance)::numeric / nullif(sum(pc.system_units), 0), 4)
  end as unit_accuracy,
  sum(pc.units_over) as units_over,
  sum(pc.units_short) as units_short,
  coalesce(sum(i.net_value_impact), 0) as net_value_impact
from per_count pc
join locations loc on loc.id = pc.location_id
left join impact i on i.stock_count_id = pc.id
group by pc.location_id, loc.name, pc.month;
