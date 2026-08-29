-- 0017_rls_movements
-- Who may write the ledger, and where (brief §5.2-§5.4, §7). No UPDATE or DELETE
-- policy exists — combined with the grant revoke (0019) and t90_block_mutation
-- (0008), the ledger is append-only for every path (test 6).
--
-- Date-window and negative-stock are enforced by triggers (0008), not here, so the
-- error messages are useful rather than a bare RLS failure.

create policy stock_movements_select on stock_movements
  for select using (auth_is_active());

create policy stock_movements_insert on stock_movements
  for insert
  with check (
    auth_is_active()
    and entered_by = auth.uid()
    and (
      -- admin / ops_manager: any location, any type except opening
      (auth_role() in ('admin', 'ops_manager') and movement_type <> 'opening')
      -- staff: own location, capture types only (never adjustment, never opening)
      or (
        auth_role() = 'staff'
        and location_id = auth_home_location()
        and movement_type in ('origination', 'transfer_out', 'transfer_in', 'dispatch', 'return')
      )
      -- opening balances: admin only (also gated by rpc_commit_opening_balances)
      or (auth_role() = 'admin' and movement_type = 'opening')
    )
    -- brief §5.4: an adjustment always carries a reason (also a table CHECK)
    and (movement_type <> 'adjustment' or reason_id is not null)
    -- brief §5.2: origination only where the location originates (also the trigger's job in spirit)
    and (
      movement_type <> 'origination'
      or exists (select 1 from locations l where l.id = location_id and l.can_originate)
    )
  );
