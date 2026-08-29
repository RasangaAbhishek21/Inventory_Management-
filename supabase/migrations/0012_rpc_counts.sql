-- 0012_rpc_counts
-- Stock-count lifecycle (brief §4.5, §7). These are the ONLY way count data is written
-- or (for staff) read at line level, so blind counting is enforced server-side: staff
-- never touch stock_count_lines directly and never receive system_qty for an open count
-- (brief §4.5, test 18). SECURITY DEFINER with explicit role checks inside.
--
-- Permissions (brief §7, test 10):
--   open / post / cancel      -> ops_manager, admin
--   add line / set qty / submit -> staff (own location), ops_manager, admin

create or replace function rpc_open_stock_count(p_location uuid, p_date date)
returns stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count stock_counts;
  v_code  text;
begin
  if auth_role() not in ('ops_manager', 'admin') then
    raise exception 'Only the Operations Manager can open a stock count.' using errcode = 'P0001';
  end if;
  if exists (select 1 from stock_counts
             where location_id = p_location and status in ('open', 'submitted')) then
    raise exception 'There is already an open count for this location. Finish it first.'
      using errcode = 'P0001';
  end if;

  select code into v_code from locations where id = p_location;
  if v_code is null then
    raise exception 'Location not found.' using errcode = 'P0001';
  end if;

  insert into stock_counts (count_ref, location_id, count_date, status, opened_by)
  values ('CNT-' || to_char(p_date, 'YYYY-MM') || '-' || v_code, p_location, p_date, 'open', auth.uid())
  returning * into v_count;

  -- Freeze the sheet against current balances. system_qty is a stored snapshot —
  -- movements entered after this do not change it (test 17).
  insert into stock_count_lines (stock_count_id, product_id, finish_id, system_qty)
  select v_count.id, b.product_id, b.finish_id, b.qty_on_hand
  from v_stock_balances b
  where b.location_id = p_location;

  return v_count;
end;
$$;

-- Internal: the caller may act on this count's location.
create or replace function fn_assert_count_writable(p_count uuid)
returns stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count stock_counts;
  v_role  text := auth_role();
begin
  select * into v_count from stock_counts where id = p_count;
  if not found then
    raise exception 'Count not found.' using errcode = 'P0001';
  end if;
  if v_role not in ('staff', 'ops_manager', 'admin') then
    raise exception 'You cannot work on a stock count.' using errcode = 'P0001';
  end if;
  if v_role = 'staff' and v_count.location_id <> auth_home_location() then
    raise exception 'You can only count stock at your own location.' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

create or replace function rpc_add_count_line(p_count uuid, p_product uuid, p_finish uuid)
returns stock_count_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count stock_counts := fn_assert_count_writable(p_count);
  v_line  stock_count_lines;
begin
  if v_count.status <> 'open' then
    raise exception 'This count is % and cannot be changed.', v_count.status using errcode = 'P0001';
  end if;

  insert into stock_count_lines (stock_count_id, product_id, finish_id, system_qty)
  values (p_count, p_product, p_finish, 0)
  returning * into v_line;

  return v_line;
exception
  when unique_violation then
    raise exception 'That item is already on the count sheet.' using errcode = 'P0001';
end;
$$;

create or replace function rpc_set_count_line(p_line uuid, p_qty integer, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_id uuid;
begin
  select stock_count_id into v_count_id from stock_count_lines where id = p_line;
  if v_count_id is null then
    raise exception 'Count line not found.' using errcode = 'P0001';
  end if;
  perform fn_assert_count_writable(v_count_id);

  if (select status from stock_counts where id = v_count_id) <> 'open' then
    raise exception 'This count is closed for entry.' using errcode = 'P0001';
  end if;
  if p_qty is not null and p_qty < 0 then
    raise exception 'A counted quantity cannot be negative.' using errcode = 'P0001';
  end if;

  update stock_count_lines
  set counted_qty = p_qty, notes = coalesce(p_notes, notes)
  where id = p_line;
end;
$$;

create or replace function rpc_submit_stock_count(p_count uuid)
returns stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count stock_counts := fn_assert_count_writable(p_count);
begin
  if v_count.status <> 'open' then
    raise exception 'This count is already %.', v_count.status using errcode = 'P0001';
  end if;
  if exists (select 1 from stock_count_lines where stock_count_id = p_count and counted_qty is null) then
    raise exception 'Every line needs a counted quantity before you can submit.' using errcode = 'P0001';
  end if;

  update stock_counts
  set status = 'submitted', submitted_by = auth.uid(), submitted_at = now()
  where id = p_count
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function rpc_post_stock_count(p_count uuid)
returns stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count        stock_counts;
  v_line         stock_count_lines;
  v_surplus_id   uuid;
  v_shortfall_id uuid;
begin
  if auth_role() not in ('ops_manager', 'admin') then
    raise exception 'Only the Operations Manager can post a stock count.' using errcode = 'P0001';
  end if;

  select * into v_count from stock_counts where id = p_count for update;
  if not found then
    raise exception 'Count not found.' using errcode = 'P0001';
  end if;
  if v_count.status <> 'submitted' then
    raise exception 'Only a submitted count can be posted. This one is %.', v_count.status
      using errcode = 'P0001';
  end if;

  select id into v_surplus_id   from adjustment_reasons where label = 'Count correction — surplus';
  select id into v_shortfall_id from adjustment_reasons where label = 'Count correction — shortfall';

  -- One adjustment per non-zero variance, dated the count date, linked to the count.
  -- t30_no_negative is bypassed because stock_count_id is set (test 21).
  for v_line in
    select * from stock_count_lines
    where stock_count_id = p_count and variance is not null and variance <> 0
  loop
    insert into stock_movements (movement_type, location_id, product_id, finish_id,
                                 quantity, unit_selling_price, transaction_date,
                                 entered_by, stock_count_id, reason_id, notes)
    values ('adjustment', v_count.location_id, v_line.product_id, v_line.finish_id,
            v_line.variance, 0, v_count.count_date, auth.uid(), p_count,
            case when v_line.variance > 0 then v_surplus_id else v_shortfall_id end,
            'Posted from ' || v_count.count_ref);
  end loop;

  update stock_counts
  set status = 'posted', posted_by = auth.uid(), posted_at = now()
  where id = p_count
  returning * into v_count;

  return v_count;
end;
$$;

create or replace function rpc_cancel_stock_count(p_count uuid, p_reason text default null)
returns stock_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count stock_counts;
begin
  if auth_role() not in ('ops_manager', 'admin') then
    raise exception 'Only the Operations Manager can cancel a stock count.' using errcode = 'P0001';
  end if;

  select * into v_count from stock_counts where id = p_count for update;
  if not found then
    raise exception 'Count not found.' using errcode = 'P0001';
  end if;
  if v_count.status = 'posted' then
    raise exception 'A posted count cannot be cancelled — correct it with adjustments.' using errcode = 'P0001';
  end if;

  update stock_counts
  set status = 'cancelled', notes = coalesce(nullif(notes, '') || ' | ', '') || coalesce(p_reason, 'cancelled')
  where id = p_count
  returning * into v_count;

  return v_count;
end;
$$;

-- The counter screen reads ONLY this view — system_qty and variance are never exposed
-- while counting (brief §4.5 blind counting, test 18). Plain view: runs with the
-- owner's rights, so staff (who have no direct SELECT on stock_count_lines) can read
-- the safe columns through it.
create view v_count_lines_blind as
select id, stock_count_id, product_id, finish_id, counted_qty, notes
from stock_count_lines;

-- Movements entered after a count was opened but dated on/before the count date —
-- these make the posted adjustment slightly wrong; the review screen warns on them
-- (brief §4.5).
create view v_count_late_movements as
select
  sc.id as stock_count_id,
  m.id  as movement_id,
  m.product_id,
  m.finish_id,
  m.quantity,
  m.transaction_date,
  m.entered_at
from stock_counts sc
join stock_movements m
  on m.location_id = sc.location_id
 and m.transaction_date <= sc.count_date
 and m.entered_at > sc.opened_at
 and m.stock_count_id is distinct from sc.id;
