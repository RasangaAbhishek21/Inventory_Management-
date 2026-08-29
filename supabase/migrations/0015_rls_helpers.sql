-- 0015_rls_helpers
-- SECURITY DEFINER helpers used by RLS policies. They read `profiles` on behalf of the
-- policy so that policies never self-join `profiles` (which would recurse). Marked STABLE
-- so the planner can cache within a statement.

create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function auth_home_location()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.home_location_id from profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function auth_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.is_active)
$$;

revoke all on function auth_role()          from public;
revoke all on function auth_home_location() from public;
revoke all on function auth_is_active()     from public;
grant execute on function auth_role()          to authenticated;
grant execute on function auth_home_location() to authenticated;
grant execute on function auth_is_active()     to authenticated;
