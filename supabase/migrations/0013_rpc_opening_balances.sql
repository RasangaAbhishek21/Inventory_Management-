-- 0013_rpc_opening_balances
-- One-time opening stock import (brief §8.12). Commits atomically as `opening`
-- movements dated the go-live date; a single unresolved row commits nothing (test 24).
--
--   p_rows: [{ "location_code", "product_name", "finish_name"?, "quantity",
--              "unit_selling_price", "unit_standard_cost"? }]

create or replace function rpc_commit_opening_balances(
  p_go_live date,
  p_rows    jsonb,
  p_force   boolean default false
)
returns integer
language plpgsql
as $$
declare
  v_row     jsonb;
  v_idx     integer := 0;
  v_loc     uuid;
  v_prod    uuid;
  v_finish  uuid;
  v_count   integer := 0;
begin
  if auth_role() <> 'admin' then
    raise exception 'Only an administrator can import opening balances.' using errcode = 'P0001';
  end if;

  if not p_force and exists (select 1 from stock_movements where movement_type = 'opening') then
    raise exception 'Opening balances have already been imported. Re-run with force to replace intent.'
      using errcode = 'P0001';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;

    select id into v_loc from locations where code = v_row->>'location_code';
    if v_loc is null then
      raise exception 'Row %: unknown location code "%".', v_idx, v_row->>'location_code'
        using errcode = 'P0001';
    end if;

    select id into v_prod from products where name = v_row->>'product_name';
    if v_prod is null then
      raise exception 'Row %: unknown product "%".', v_idx, v_row->>'product_name'
        using errcode = 'P0001';
    end if;

    v_finish := null;
    if coalesce(v_row->>'finish_name', '') <> '' then
      select id into v_finish from finishes where name = v_row->>'finish_name';
      if v_finish is null then
        raise exception 'Row %: unknown finish "%".', v_idx, v_row->>'finish_name'
          using errcode = 'P0001';
      end if;
    end if;

    if (v_row->>'quantity')::integer = 0 then
      raise exception 'Row %: quantity cannot be zero.', v_idx using errcode = 'P0001';
    end if;

    insert into stock_movements (movement_type, location_id, product_id, finish_id,
                                 quantity, unit_selling_price, unit_standard_cost,
                                 transaction_date, entered_by, notes)
    values ('opening', v_loc, v_prod, v_finish,
            (v_row->>'quantity')::integer,
            (v_row->>'unit_selling_price')::numeric,
            nullif(v_row->>'unit_standard_cost', '')::numeric,
            p_go_live, auth.uid(), 'Opening balance import');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
