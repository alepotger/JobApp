-- Application tracker — database setup.
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
--
-- Creates one table, restricts it to the signed-in owner, and turns on
-- realtime so changes reach your other devices.

create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company     text not null default '',
  role_title  text not null default '',
  location    text not null default '',
  status      text not null default 'to-apply',
  replies     text not null default '',
  next_steps  text not null default '',
  notes       text not null default '',
  activity    timestamptz not null default now(),
  sort_order  bigint not null default 0,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.applications
  alter column user_id set default auth.uid();

create index if not exists applications_user_idx
  on public.applications (user_id, sort_order);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.applications to authenticated;

alter table public.applications enable row level security;

drop policy if exists "owner full access" on public.applications;
create policy "owner full access"
  on public.applications
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'applications'
  ) then
    alter publication supabase_realtime add table public.applications;
  end if;
end $$;
