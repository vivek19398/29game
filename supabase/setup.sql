-- Run in Supabase SQL Editor. These tables are accessible only to the server.
create table if not exists public.twenty_nine_rooms (
 code text primary key,
 version integer not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.twenty_nine_rooms enable row level security;
revoke all on public.twenty_nine_rooms from anon, authenticated;
grant all on public.twenty_nine_rooms to service_role;
create table if not exists public.twenty_nine_limits (
 key text primary key, window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table public.twenty_nine_limits enable row level security;
revoke all on public.twenty_nine_limits from anon, authenticated;
create or replace function public.twenty_nine_rate_limit(p_key text, p_max integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into twenty_nine_limits as t(key) values(p_key)
 on conflict(key) do update set
 attempts=case when t.window_start < now()-make_interval(secs=>p_seconds) then 1 else t.attempts+1 end,
 window_start=case when t.window_start < now()-make_interval(secs=>p_seconds) then now() else t.window_start end
 returning attempts into n;
 return n<=p_max;
end; $$;
revoke all on function public.twenty_nine_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.twenty_nine_rate_limit(text,integer,integer) to service_role;
-- Optional maintenance: delete rooms older than 30 days and old rate-limit rows.
-- delete from public.twenty_nine_rooms where updated_at < now()-interval '30 days';
-- delete from public.twenty_nine_limits where window_start < now()-interval '1 day';
