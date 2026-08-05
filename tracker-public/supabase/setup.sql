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
  add column if not exists contact_email  text     not null default '',
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

-- ---------------------------------------------------------------------------
-- Pages: several independent collections of applications in one account.
-- Included here so a fresh install needs no follow-up migration.
-- ---------------------------------------------------------------------------

create table if not exists public.tracker_pages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references auth.users(id) on delete cascade,
  name       text not null default 'Applications',
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tracker_pages_user_idx
  on public.tracker_pages (user_id, sort_order);

alter table public.tracker_pages enable row level security;

-- FOR ALL, matching public.applications: a policy that covers writes but not
-- reads lets an insert appear to succeed and then vanish on read-back.
drop policy if exists "owner full access pages" on public.tracker_pages;
create policy "owner full access pages"
  on public.tracker_pages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.tracker_pages to authenticated;

-- Nullable on purpose, and this is the safety mechanism rather than an
-- oversight: on delete set null means a deleted page leaves its applications
-- pointing nowhere instead of pointing somewhere wrong, and the page reads a
-- null page_id as "the first page". No application can become invisible.
alter table public.applications
  add column if not exists page_id uuid
    references public.tracker_pages(id) on delete set null;

create index if not exists applications_page_idx
  on public.applications (user_id, page_id, sort_order);

-- One default page for any account that has applications and no page yet.
insert into public.tracker_pages (user_id, name, sort_order)
select distinct a.user_id, 'Applications', 0
  from public.applications a
 where not exists (
   select 1 from public.tracker_pages p where p.user_id = a.user_id
 );

-- Nothing becomes invisible: every existing application lands on that page.
update public.applications a
   set page_id = (
     select p.id from public.tracker_pages p
      where p.user_id = a.user_id
      order by p.sort_order, p.created_at
      limit 1
   )
 where a.page_id is null;

-- A page renamed on one device shows up on the others.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tracker_pages'
  ) then
    alter publication supabase_realtime add table public.tracker_pages;
  end if;
end $$;
