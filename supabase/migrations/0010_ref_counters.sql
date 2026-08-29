-- 0010_ref_counters
-- Human-readable references: TRF-2026-0041, CNT-2026-03-MAH.
-- ref_counters has no RLS policy (0014 enables RLS on it) so it is reachable only
-- through this SECURITY DEFINER function, called from the RPCs.

create table ref_counters (
  scope  text not null,
  period text not null,
  seq    integer not null default 0,
  primary key (scope, period)
);

create or replace function fn_next_ref(p_scope text, p_period text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  insert into ref_counters (scope, period, seq)
  values (p_scope, p_period, 1)
  on conflict (scope, period)
  do update set seq = ref_counters.seq + 1
  returning seq into v_seq;

  return p_prefix || '-' || p_period || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke all on function fn_next_ref(text, text, text) from public;
