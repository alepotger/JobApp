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

-- Offer details, company scoring and stage history. Kept as separate ALTERs so
-- this script also upgrades a table created before these columns existed.
alter table public.applications
  add column if not exists salary         text     not null default '',
  add column if not exists equity         text     not null default '',
  add column if not exists start_date     date,
  add column if not exists benefits_score smallint not null default 0,
  add column if not exists score_salary   smallint not null default 0,
  add column if not exists score_growth   smallint not null default 0,
  add column if not exists score_culture  smallint not null default 0,
  add column if not exists score_location smallint not null default 0,
  add column if not exists stage_history  jsonb    not null default '[]'::jsonb;

-- Ratings run 1-5, with 0 meaning "not rated yet".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_score_range'
  ) then
    alter table public.applications
      add constraint applications_score_range check (
        benefits_score between 0 and 5
        and score_salary   between 0 and 5
        and score_growth   between 0 and 5
        and score_culture  between 0 and 5
        and score_location between 0 and 5
      );
  end if;
end $$;

-- Anchor pre-existing rows at their current stage so the funnel starts
-- measuring from the next move each one makes.
update public.applications
   set stage_history = jsonb_build_array(
         jsonb_build_object('to', status, 'at', activity)
       )
 where stage_history = '[]'::jsonb;

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
