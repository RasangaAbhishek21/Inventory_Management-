-- 0016_rls_reference
-- Policies for reference tables and profiles.
--   read  : every active authenticated user sees all reference data and all stock
--           (brief §7 — "View stock, all locations" is granted to everyone).
--   write : ops_manager / admin manage products, finishes, categories, locations.
--           admin manages users and roles.
-- The finance-can-edit-only-standard_cost rule needs column privileges + a trigger and
-- lands in a later migration (step 3, admin).

-- ----- profiles -----
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

create policy profiles_admin_read on profiles
  for select using (auth_role() = 'admin');

create policy profiles_admin_write on profiles
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ----- reference: read for all active users -----
create policy locations_read on locations
  for select using (auth_is_active());
create policy product_categories_read on product_categories
  for select using (auth_is_active());
create policy finishes_read on finishes
  for select using (auth_is_active());
create policy products_read on products
  for select using (auth_is_active());
create policy adjustment_reasons_read on adjustment_reasons
  for select using (auth_is_active());

-- ----- reference: write for ops_manager / admin -----
create policy locations_write on locations
  for all using (auth_role() in ('ops_manager','admin'))
  with check (auth_role() in ('ops_manager','admin'));
create policy product_categories_write on product_categories
  for all using (auth_role() in ('ops_manager','admin'))
  with check (auth_role() in ('ops_manager','admin'));
create policy finishes_write on finishes
  for all using (auth_role() in ('ops_manager','admin'))
  with check (auth_role() in ('ops_manager','admin'));
create policy products_write on products
  for all using (auth_role() in ('ops_manager','admin'))
  with check (auth_role() in ('ops_manager','admin'));
create policy adjustment_reasons_write on adjustment_reasons
  for all using (auth_role() in ('ops_manager','admin'))
  with check (auth_role() in ('ops_manager','admin'));
