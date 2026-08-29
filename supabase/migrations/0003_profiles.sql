-- 0003_profiles
-- One row per user, keyed to auth.users. Accounts are admin-created only — there is
-- no self-signup and no handle_new_user trigger (brief §3, §4.2). The admin route
-- handler / scripts/create-admin.ts insert this row right after auth.admin.createUser.

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null,
  role             text not null check (role in ('admin','ops_manager','finance','staff')),
  home_location_id uuid references locations(id),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);
create index profiles_home_location_idx on profiles (home_location_id);
