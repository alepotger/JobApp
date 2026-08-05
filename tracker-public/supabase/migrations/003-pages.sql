-- Application tracker — pages.
--
-- Several independent collections of applications inside one account,
-- switchable like sheets in a spreadsheet.
--
-- Run this in the Supabase SQL Editor. It is idempotent, additive and never
-- destructive: every statement is guarded, every existing application is put
-- on a default page, and nothing is dropped, renamed or deleted.
--
-- The tracker keeps working without this. A database that never runs it shows
-- a dismissible notice and behaves exactly as it did before — no pages, no
-- degraded mode. This file is also embedded in index.html as PAGES_SQL and is
-- generated from it, so the two cannot drift.

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
