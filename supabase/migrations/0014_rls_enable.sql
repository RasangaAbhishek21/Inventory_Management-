-- 0014_rls_enable
-- Row Level Security on. Authorisation rules live in the DB, not the UI (brief §3).
-- Tables with RLS enabled and no policy are readable/writable only by the service role
-- and SECURITY DEFINER functions — that is the intended default for ref_counters etc.

alter table locations           enable row level security;
alter table product_categories  enable row level security;
alter table finishes            enable row level security;
alter table products            enable row level security;
alter table adjustment_reasons  enable row level security;
alter table profiles            enable row level security;
alter table transfers           enable row level security;
alter table transfer_lines      enable row level security;
alter table stock_counts        enable row level security;
alter table stock_count_lines   enable row level security;
alter table stock_movements     enable row level security;
