-- Application tracker — inbound email sync and the weekly digest.
--
-- Run this in the Supabase SQL Editor before deploying the Edge Functions.
-- Idempotent: running it twice changes nothing.

create extension if not exists pgcrypto;

-- The address a company writes from. When set, an inbound reply matches this
-- row outright instead of being guessed at from the company name.
alter table public.applications
  add column if not exists contact_email text not null default '';

-- One row per user: where the digest goes, and the token that identifies this
-- account in an inbound address.
create table if not exists public.tracker_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade
                   default auth.uid(),
  inbound_token  text not null unique default encode(gen_random_bytes(9), 'hex'),
  digest_email   text,
  digest_enabled boolean not null default true,
  stale_after    smallint not null default 7,
  last_digest_at timestamptz
);

alter table public.tracker_settings enable row level security;

drop policy if exists "owner settings" on public.tracker_settings;
create policy "owner settings"
  on public.tracker_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.tracker_settings to authenticated;

-- Ledger of inbound messages already applied. The webhook writes here first,
-- so a provider retrying a delivery cannot append the same reply twice.
create table if not exists public.inbound_messages (
  message_id     text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  from_address   text not null default '',
  subject        text not null default '',
  matched_by     text not null default '',
  received_at    timestamptz not null default now()
);

create index if not exists inbound_messages_user_idx
  on public.inbound_messages (user_id, received_at desc);

alter table public.inbound_messages enable row level security;

-- Readable by the owner; only the service role (the Edge Function) writes.
drop policy if exists "owner reads inbound" on public.inbound_messages;
create policy "owner reads inbound"
  on public.inbound_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.inbound_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges for the Edge Functions.
--
-- The functions connect as service_role, not as a signed-in user. Everything
-- above this line — and all of setup.sql — grants only to `authenticated`,
-- which was right while the browser was the only client. It leaves the
-- functions unable to read anything: PostgREST returns
--   {"error": "permission denied for table tracker_settings"}
-- on the digest's first query.
--
-- service_role bypasses RLS, so no policy is needed or changed here; bypassing
-- RLS is not the same as holding table privileges, and it held none. Granted
-- to match what the two functions actually do, and no more — neither deletes,
-- so neither gets DELETE.
--
-- Harmless to run on a project that never deploys the functions: service_role
-- is not reachable from the browser, which authenticates as `authenticated`.
-- ---------------------------------------------------------------------------

grant select, update         on public.applications     to service_role;
grant select, update         on public.tracker_settings to service_role;
grant select, insert, update on public.inbound_messages to service_role;

-- Give every existing account its settings row.
insert into public.tracker_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- And every future one.
create or replace function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tracker_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();


-- ---------------------------------------------------------------------------
-- Weekly digest schedule.
--
-- Runs Mondays at 08:00 UTC. Both extensions are available on Supabase but are
-- off by default. Replace <PROJECT-REF> and <CRON_SECRET> before running this
-- block; CRON_SECRET must match the value set with
--   supabase secrets set CRON_SECRET=...
--
-- Left commented out so the rest of this migration applies cleanly without it.
-- ---------------------------------------------------------------------------

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.unschedule('weekly-digest')
--  where exists (select 1 from cron.job where jobname = 'weekly-digest');
--
-- select cron.schedule(
--   'weekly-digest',
--   '0 8 * * 1',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/weekly-digest',
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'x-cron-secret', '<CRON_SECRET>'
--                ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
