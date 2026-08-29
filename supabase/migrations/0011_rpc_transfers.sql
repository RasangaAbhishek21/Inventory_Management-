-- 0011_rpc_transfers
-- The two-step transfer as atomic operations (brief §4.4). SECURITY INVOKER — RLS on
-- transfers / transfer_lines / stock_movements still applies; these functions add
-- friendly errors and do the multi-row work in one transaction.
--
--   p_lines for dispatch:  [{ "product_id", "finish_id"?, "variant_note"?, "qty" }]
--   p_lines for receive:   [{ "line_id", "qty_received" }]

create or replace function rpc_dispatch_transfer(
  p_from   uuid,
  p_to     uuid,
  p_date   date,
  p_order  text,
  p_notes  text,
  p_lines  jsonb
)
returns transfers
language plpgsql
as $$
declare
  v_transfer transfers;
  v_ref      text;
  v_line     jsonb;
  v_finish   uuid;
  v_sell     numeric;
  v_cost     numeric;
  v_prod_sell numeric;
  v_prod_cost numeric;
begin
  if p_from = p_to then
    raise exception 'A transfer needs two different locations.' using errcode = 'P0001';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line before sending.' using errcode = 'P0001';
  end if;

  v_ref := fn_next_ref('transfer', to_char(p_date, 'YYYY'), 'TRF');

  insert into transfers (transfer_ref, from_location_id, to_location_id, status,
                         dispatch_date, dispatched_by, order_number, notes)
  values (v_ref, p_from, p_to, 'dispatched', p_date, auth.uid(), p_order, p_notes)
  returning * into v_transfer;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_finish := nullif(v_line->>'finish_id', '')::uuid;

    select selling_price, standard_cost into v_prod_sell, v_prod_cost
    from products where id = (v_line->>'product_id')::uuid;

    select coalesce(avg_selling, v_prod_sell), coalesce(avg_cost, v_prod_cost)
      into v_sell, v_cost
    from fn_avg_unit_value(p_from, (v_line->>'product_id')::uuid, v_finish);

    insert into transfer_lines (transfer_id, product_id, finish_id, variant_note,
                                qty_dispatched, unit_selling_price, unit_standard_cost)
    values (v_transfer.id, (v_line->>'product_id')::uuid, v_finish,
            nullif(v_line->>'variant_note', ''),
            (v_line->>'qty')::integer, v_sell, v_cost);

    -- transfer_out: negative at the source. The t10 trigger re-stamps the value
    -- from fn_avg_unit_value; t30 enforces stock availability.
    insert into stock_movements (movement_type, location_id, product_id, finish_id,
                                 variant_note, quantity, unit_selling_price,
                                 transaction_date, entered_by, transfer_id, order_number)
    values ('transfer_out', p_from, (v_line->>'product_id')::uuid, v_finish,
            nullif(v_line->>'variant_note', ''),
            -1 * (v_line->>'qty')::integer, v_sell,
            p_date, auth.uid(), v_transfer.id, p_order);
  end loop;

  return v_transfer;
end;
$$;

create or replace function rpc_receive_transfer(
  p_transfer uuid,
  p_date     date,
  p_lines    jsonb
)
returns transfers
language plpgsql
as $$
declare
  v_transfer transfers;
  v_line     jsonb;
  v_tl       transfer_lines;
  v_recv     integer;
  v_variance boolean := false;
begin
  select * into v_transfer from transfers where id = p_transfer for update;
  if not found then
    raise exception 'Transfer not found.' using errcode = 'P0001';
  end if;
  if v_transfer.status <> 'dispatched' then
    raise exception 'This transfer is already %.', v_transfer.status using errcode = 'P0001';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    select * into v_tl from transfer_lines
    where id = (v_line->>'line_id')::uuid and transfer_id = p_transfer;
    if not found then
      raise exception 'Unknown transfer line.' using errcode = 'P0001';
    end if;

    v_recv := (v_line->>'qty_received')::integer;
    if v_recv < 0 then
      raise exception 'Received quantity cannot be negative.' using errcode = 'P0001';
    end if;
    if v_recv > v_tl.qty_dispatched then
      raise exception 'You received more than were sent (% vs %). Ask the sender to correct the dispatch.',
        v_recv, v_tl.qty_dispatched using errcode = 'P0001';
    end if;

    update transfer_lines set qty_received = v_recv where id = v_tl.id;

    if v_recv < v_tl.qty_dispatched then
      v_variance := true;
    end if;

    if v_recv > 0 then
      -- transfer_in: positive at the destination, values copied from the line.
      insert into stock_movements (movement_type, location_id, product_id, finish_id,
                                   variant_note, quantity, unit_selling_price,
                                   unit_standard_cost, transaction_date, entered_by,
                                   transfer_id, order_number)
      values ('transfer_in', v_transfer.to_location_id, v_tl.product_id, v_tl.finish_id,
              v_tl.variant_note, v_recv, v_tl.unit_selling_price, v_tl.unit_standard_cost,
              p_date, auth.uid(), v_transfer.id, v_transfer.order_number);
    end if;
  end loop;

  -- Any line without a submitted qty_received is treated as a full-line variance.
  if exists (select 1 from transfer_lines where transfer_id = p_transfer and qty_received is null) then
    v_variance := true;
  end if;

  update transfers
  set status = case when v_variance then 'received_with_variance' else 'received' end,
      receipt_date = p_date,
      received_by = auth.uid(),
      received_at = now()
  where id = p_transfer
  returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function rpc_cancel_transfer(p_transfer uuid, p_reason text)
returns transfers
language plpgsql
as $$
declare
  v_transfer transfers;
  v_tl       transfer_lines;
  v_orig_id  bigint;
begin
  if auth_role() not in ('ops_manager', 'admin') then
    raise exception 'Only the Operations Manager can cancel a dispatched transfer.' using errcode = 'P0001';
  end if;

  select * into v_transfer from transfers where id = p_transfer for update;
  if not found then
    raise exception 'Transfer not found.' using errcode = 'P0001';
  end if;
  if v_transfer.status <> 'dispatched' then
    raise exception 'Only a dispatched transfer can be cancelled. This one is %.', v_transfer.status
      using errcode = 'P0001';
  end if;

  for v_tl in select * from transfer_lines where transfer_id = p_transfer
  loop
    select id into v_orig_id from stock_movements
    where transfer_id = p_transfer and movement_type = 'transfer_out'
      and product_id = v_tl.product_id and finish_id is not distinct from v_tl.finish_id
      and reverses_movement_id is null
    order by id limit 1;

    insert into stock_movements (movement_type, location_id, product_id, finish_id,
                                 variant_note, quantity, unit_selling_price,
                                 transaction_date, entered_by, transfer_id,
                                 reverses_movement_id, notes)
    values ('transfer_out', v_transfer.from_location_id, v_tl.product_id, v_tl.finish_id,
            v_tl.variant_note, v_tl.qty_dispatched, 0,
            current_date, auth.uid(), p_transfer, v_orig_id,
            coalesce(p_reason, 'Transfer cancelled'));
  end loop;

  update transfers set status = 'cancelled', notes = coalesce(notes || ' | ', '') || coalesce(p_reason, 'cancelled')
  where id = p_transfer
  returning * into v_transfer;

  return v_transfer;
end;
$$;
