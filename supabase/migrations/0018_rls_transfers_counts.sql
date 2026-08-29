-- 0018_rls_transfers_counts
-- RLS for transfers, transfer_lines, stock_counts, stock_count_lines (brief §7).
-- Everyone active reads; writes are scoped. transfer_lines and stock_count_lines are
-- only ever written through the SECURITY DEFINER RPCs, but the policies still hold.

-- ---------------- transfers ----------------
create policy transfers_select on transfers
  for select using (auth_is_active());

create policy transfers_insert on transfers
  for insert with check (
    auth_role() in ('admin', 'ops_manager')
    or (auth_role() = 'staff' and from_location_id = auth_home_location())
  );

create policy transfers_update on transfers
  for update using (
    auth_role() in ('admin', 'ops_manager')
    or (auth_role() = 'staff'
        and (from_location_id = auth_home_location() or to_location_id = auth_home_location()))
  );

-- ---------------- transfer_lines ----------------
create policy transfer_lines_select on transfer_lines
  for select using (auth_is_active());

create policy transfer_lines_write on transfer_lines
  for all
  using (
    exists (
      select 1 from transfers t
      where t.id = transfer_id
        and (auth_role() in ('admin', 'ops_manager')
             or auth_home_location() in (t.from_location_id, t.to_location_id))
    )
  )
  with check (
    exists (
      select 1 from transfers t
      where t.id = transfer_id
        and (auth_role() in ('admin', 'ops_manager')
             or auth_home_location() in (t.from_location_id, t.to_location_id))
    )
  );

-- ---------------- stock_counts ----------------
-- Everyone reads; only ops_manager / admin open, submit is handled in the RPC
-- (SECURITY DEFINER), post and cancel are ops_manager / admin (test 10).
create policy stock_counts_select on stock_counts
  for select using (auth_is_active());

create policy stock_counts_write on stock_counts
  for all
  using (auth_role() in ('ops_manager', 'admin'))
  with check (auth_role() in ('ops_manager', 'admin'));

-- ---------------- stock_count_lines ----------------
-- Only ops_manager / admin may SELECT the real table (it carries system_qty).
-- Staff read the blind view instead and write only via the RPCs. No staff policy
-- here at all — the RPCs are SECURITY DEFINER.
create policy stock_count_lines_read on stock_count_lines
  for select using (auth_role() in ('ops_manager', 'admin'));

create policy stock_count_lines_write on stock_count_lines
  for all
  using (auth_role() in ('ops_manager', 'admin'))
  with check (auth_role() in ('ops_manager', 'admin'));
