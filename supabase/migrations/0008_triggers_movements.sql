-- 0008_triggers_movements
-- The invariants of the ledger, enforced in the database (brief §5). Three BEFORE INSERT
-- triggers on stock_movements fire in name order:
--   t10_stamp_values  -> authoritative unit valuation (brief §6)
--   t20_date_window   -> no forward-dating; staff backdate limit
--   t30_no_negative   -> no negative stock (count adjustments exempt)
-- plus t90_block_mutation -> stock_movements is append-only.

-- ---------------------------------------------------------------------------
-- app_config: DB-visible mirror of the tunables in src/config.ts (plan §6).
-- Changing a value the DB reads = a new migration, by design.
-- ---------------------------------------------------------------------------
create table app_config (
  key   text primary key,
  value numeric not null
);

insert into app_config (key, value) values
  ('BACKDATE_LIMIT_DAYS', 30),
  ('ADJ_QTY_EXCEPTION',   3),
  ('ADJ_VALUE_EXCEPTION', 100000)
on conflict (key) do nothing;

create or replace function fn_config_int(p_key text)
returns integer
language sql
stable
as $$ select value::integer from app_config where key = p_key $$;

-- ---------------------------------------------------------------------------
-- t10_stamp_values — every movement carries the unit values at the moment it
-- was created; nothing is ever looked up live afterwards (brief §5.7, §6).
-- ---------------------------------------------------------------------------
create or replace function fn_stamp_movement_values()
returns trigger
language plpgsql
as $$
declare
  v_avg_sell numeric;
  v_avg_cost numeric;
  v_prod_sell numeric;
  v_prod_cost numeric;
  v_balance  integer;
begin
  -- A reversal copies the values of the row it reverses, so the balance value
  -- returns to exactly its prior figure (test 5).
  if new.reverses_movement_id is not null then
    select unit_selling_price, unit_standard_cost
      into new.unit_selling_price, new.unit_standard_cost
    from stock_movements where id = new.reverses_movement_id;
    return new;
  end if;

  -- opening: values come from the import CSV. transfer_in: copied from the
  -- transfer line by the receive RPC. Both are supplied by the caller.
  if new.movement_type in ('opening', 'transfer_in') then
    return new;
  end if;

  select selling_price, standard_cost into v_prod_sell, v_prod_cost
  from products where id = new.product_id;

  if new.movement_type in ('origination', 'return') then
    new.unit_selling_price := v_prod_sell;
    new.unit_standard_cost := v_prod_cost;
    return new;
  end if;

  select avg_selling, avg_cost into v_avg_sell, v_avg_cost
  from fn_avg_unit_value(new.location_id, new.product_id, new.finish_id);

  if new.movement_type in ('transfer_out', 'dispatch') then
    new.unit_selling_price := coalesce(v_avg_sell, v_prod_sell);
    new.unit_standard_cost := coalesce(v_avg_cost, v_prod_cost);
    return new;
  end if;

  if new.movement_type = 'adjustment' then
    select coalesce(sum(quantity), 0) into v_balance
    from stock_movements
    where location_id = new.location_id
      and product_id = new.product_id
      and finish_id is not distinct from new.finish_id;

    if new.quantity > 0 and v_balance <= 0 then
      -- positive adjustment / count surplus at a location holding zero of the item:
      -- fall back to the product price so there is no divide-by-zero (test 16).
      new.unit_selling_price := v_prod_sell;
      new.unit_standard_cost := v_prod_cost;
    else
      new.unit_selling_price := coalesce(v_avg_sell, v_prod_sell);
      new.unit_standard_cost := coalesce(v_avg_cost, v_prod_cost);
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger t10_stamp_values
  before insert on stock_movements
  for each row execute function fn_stamp_movement_values();

-- ---------------------------------------------------------------------------
-- t20_date_window — transaction_date may be backdated but never forward-dated
-- (brief §5.6). staff are limited to BACKDATE_LIMIT_DAYS; admin/ops_manager are
-- not. Count adjustments are dated count_date, already validated at count open.
-- ---------------------------------------------------------------------------
create or replace function fn_check_movement_date()
returns trigger
language plpgsql
as $$
declare
  v_role  text := auth_role();
  v_limit integer := fn_config_int('BACKDATE_LIMIT_DAYS');
begin
  if new.transaction_date > current_date then
    raise exception 'That date is in the future. A movement is dated when it physically happened.'
      using errcode = 'P0001';
  end if;

  if new.stock_count_id is not null then
    return new;
  end if;

  if v_role = 'staff' and new.transaction_date < current_date - (v_limit || ' days')::interval then
    raise exception 'That date is more than % days ago. Ask the Operations Manager to record it.', v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger t20_date_window
  before insert on stock_movements
  for each row execute function fn_check_movement_date();

-- ---------------------------------------------------------------------------
-- t30_no_negative — a transfer_out, dispatch or negative adjustment may not
-- take (location, product, finish) below zero (brief §5.1). The error names the
-- location and the quantity available. Adjustments generated by posting a stock
-- count bypass this — a count is by definition the authority on physical reality
-- (brief §5.1 exception, test 21).
-- ---------------------------------------------------------------------------
create or replace function fn_guard_negative_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance   integer;
  v_resulting integer;
  v_loc_name  text;
begin
  if new.stock_count_id is not null then
    return new;
  end if;

  if new.quantity >= 0 then
    return new;
  end if;

  select coalesce(sum(quantity), 0) into v_balance
  from stock_movements
  where location_id = new.location_id
    and product_id = new.product_id
    and finish_id is not distinct from new.finish_id;

  v_resulting := v_balance + new.quantity;

  if v_resulting < 0 then
    select name into v_loc_name from locations where id = new.location_id;
    raise exception 'Only % available at %. Ask the Operations Manager to post an adjustment before moving %.',
      v_balance, v_loc_name, abs(new.quantity)
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger t30_no_negative
  before insert on stock_movements
  for each row execute function fn_guard_negative_stock();

-- ---------------------------------------------------------------------------
-- t90_block_mutation — stock_movements is append-only (brief §4.3, §5.8, test 6).
-- Grants are revoked in 0019; this trigger blocks even the table owner.
-- ---------------------------------------------------------------------------
create or replace function fn_block_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_movements is append-only. Correct a mistake with a reversing movement.'
    using errcode = 'P0001';
end;
$$;

create trigger t90_block_mutation
  before update or delete on stock_movements
  for each row execute function fn_block_movement_mutation();
