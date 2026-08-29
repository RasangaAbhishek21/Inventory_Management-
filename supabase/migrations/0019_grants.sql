-- 0019_grants
-- Lock the ledger to append-only at the privilege level, expose the RPCs, and let
-- Finance maintain products.standard_cost (and nothing else on products).

-- The ledger is append-only (brief §4.3, §5.8, test 6). Belt to the trigger's braces.
revoke update, delete on stock_movements from authenticated, anon;

-- ref_counters / app_config are internal — reached only via SECURITY DEFINER functions.
revoke all on ref_counters from authenticated, anon;
revoke all on app_config   from authenticated, anon;

-- fn_config_int reads app_config; make it run with definer rights so callers need no
-- grant on the table.
create or replace function fn_config_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$ select value::integer from app_config where key = p_key $$;

-- Expose the write RPCs to signed-in users. Each one checks role/location internally.
grant execute on function
  rpc_dispatch_transfer(uuid, uuid, date, text, text, jsonb),
  rpc_receive_transfer(uuid, date, jsonb),
  rpc_cancel_transfer(uuid, text),
  rpc_open_stock_count(uuid, date),
  rpc_add_count_line(uuid, uuid, uuid),
  rpc_set_count_line(uuid, integer, text),
  rpc_submit_stock_count(uuid),
  rpc_post_stock_count(uuid),
  rpc_cancel_stock_count(uuid, text),
  rpc_commit_opening_balances(date, jsonb, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Finance maintains standard_cost (brief §7). RLS lets Finance UPDATE products;
-- a trigger rejects any change by Finance to a column other than standard_cost.
-- ---------------------------------------------------------------------------
create policy products_finance_cost on products
  for update
  using (auth_role() = 'finance')
  with check (auth_role() = 'finance');

create or replace function fn_guard_finance_product_edit()
returns trigger
language plpgsql
as $$
begin
  if auth_role() = 'finance' then
    if new.name is distinct from old.name
       or new.category_id is distinct from old.category_id
       or new.selling_price is distinct from old.selling_price
       or new.image_path is distinct from old.image_path
       or new.shopify_sku is distinct from old.shopify_sku
       or new.is_active is distinct from old.is_active
       or new.id is distinct from old.id then
      raise exception 'Finance can only change the standard cost of a product.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger t_products_finance_guard
  before update on products
  for each row execute function fn_guard_finance_product_edit();
