-- Application tracker — offer details, company scoring and stage history.
--
-- Run this in the Supabase SQL Editor if you set the tracker up before these
-- fields existed. It is idempotent: running it twice changes nothing. A fresh
-- install does not need it, because setup.sql already includes everything here.

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

-- Anchor rows that predate stage_history at their current stage, so the funnel
-- starts measuring from the next move each one makes. Deliberately does not
-- invent the earlier steps: a mean built from guessed dates would be worse than
-- one built from fewer real ones.
update public.applications
   set stage_history = jsonb_build_array(
         jsonb_build_object('to', status, 'at', activity)
       )
 where stage_history = '[]'::jsonb;
