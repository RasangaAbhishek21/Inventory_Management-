-- 0002_reference_tables
-- Reference / master data. Verbatim from brief §4.1 with an updated_at trigger on
-- products and a trgm index for the name picker.

create table locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- 'Maharagama Factory'
  code          text not null unique,          -- 'MAH'
  location_type text not null check (location_type in ('factory','showroom')),
  can_originate boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- 'Tables', 'Storage', 'Mirrors'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table finishes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- 'White', 'Oak', 'Walnut'
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                -- must match the Shopify product title exactly
  category_id    uuid references product_categories(id),
  selling_price  numeric(12,2) not null,
  standard_cost  numeric(12,2),                -- maintained by Finance; nullable until populated
  image_path     text,                         -- Supabase Storage object path
  shopify_sku    text,                         -- deliberately unused in v2; do not remove
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_name_trgm_idx on products using gin (name extensions.gin_trgm_ops);
create index products_category_idx on products (category_id);

create table adjustment_reasons (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique,
  requires_note boolean not null default false,
  is_system     boolean not null default false, -- system reasons cannot be deactivated
  is_active     boolean not null default true
);

-- keep products.updated_at honest
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger t_products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- system adjustment reasons may not be deactivated (brief §4.1)
create or replace function guard_system_reason()
returns trigger
language plpgsql
as $$
begin
  if old.is_system and (new.is_active = false or new.is_system = false) then
    raise exception 'This is a system reason and cannot be deactivated.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger t_adjustment_reasons_guard
  before update on adjustment_reasons
  for each row execute function guard_system_reason();
