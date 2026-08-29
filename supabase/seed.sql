-- seed.sql — runs after migrations on `supabase db reset`.
-- Reference data from brief §4.1. Idempotent so it can re-run safely.

insert into locations (name, code, location_type, can_originate) values
  ('Maharagama Factory',  'MAH', 'factory',  true),
  ('Gonapola Factory',    'GON', 'factory',  true),
  ('Piliyandala Showroom','PIL', 'showroom', false)
on conflict (code) do nothing;

insert into product_categories (name, sort_order) values
  ('Tables',          10),
  ('Storage',         20),
  ('Dressing Tables', 30),
  ('Mirrors',         40),
  ('TV Console',      50),
  ('Coffee Table',    60),
  ('Side Table',      70)
on conflict (name) do nothing;

-- Starter finishes only — full list to be confirmed with the client (plan §14).
insert into finishes (name, sort_order) values
  ('White',  10),
  ('Oak',    20),
  ('Walnut', 30)
on conflict (name) do nothing;

insert into adjustment_reasons (label, requires_note, is_system) values
  ('Damaged in factory',          false, false),
  ('Damaged in transit',          false, false),
  ('Lost / unaccounted',          false, false),
  ('Count correction — surplus',  false, true),
  ('Count correction — shortfall',false, true),
  ('Returned to production',      false, false),
  ('Written off — quality',       false, false),
  ('Other',                       true,  false)
on conflict (label) do nothing;
