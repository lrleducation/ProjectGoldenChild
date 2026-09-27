-- Project Golden Child v1.0.12
-- Repair the remaining admin database columns shown by System Health.
-- Safe to run repeatedly. Does not delete existing records.

create extension if not exists pgcrypto;

-- =========================================================
-- HEROES
-- =========================================================

alter table public.heroes add column if not exists referral_id text;
alter table public.heroes add column if not exists child_name text;
alter table public.heroes add column if not exists preferred_name text;
alter table public.heroes add column if not exists date_of_birth date;
alter table public.heroes add column if not exists postcode_prefix text;
alter table public.heroes add column if not exists life_status text;
alter table public.heroes add column if not exists cancer_type text;
alter table public.heroes add column if not exists diagnosis_date_text text;
alter table public.heroes add column if not exists journey_notes text;
alter table public.heroes add column if not exists interests text;
alter table public.heroes add column if not exists primary_contact_name text;
alter table public.heroes add column if not exists primary_contact_email text;
alter table public.heroes add column if not exists primary_contact_phone text;
alter table public.heroes add column if not exists consent_recognition boolean default false;
alter table public.heroes add column if not exists consent_events boolean default false;
alter table public.heroes add column if not exists consent_updates boolean default false;
alter table public.heroes add column if not exists consent_media_interest boolean default false;
alter table public.heroes add column if not exists status text default 'active';
alter table public.heroes add column if not exists admin_notes text;
alter table public.heroes add column if not exists created_at timestamptz default now();
alter table public.heroes add column if not exists updated_at timestamptz default now();

-- Add the referral foreign key only if it is not already present.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'heroes_referral_id_fkey'
      and conrelid = 'public.heroes'::regclass
  ) then
    alter table public.heroes
      add constraint heroes_referral_id_fkey
      foreign key (referral_id)
      references public.referrals(id)
      on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists heroes_referral_id_unique_idx
  on public.heroes(referral_id)
  where referral_id is not null;

-- =========================================================
-- HERO ACTIONS
-- =========================================================

alter table public.hero_actions add column if not exists hero_id text;
alter table public.hero_actions add column if not exists action_type text;
alter table public.hero_actions add column if not exists title text;
alter table public.hero_actions add column if not exists due_date date;
alter table public.hero_actions add column if not exists status text default 'open';
alter table public.hero_actions add column if not exists notes text;
alter table public.hero_actions add column if not exists value_gbp numeric(10,2) default 0;
alter table public.hero_actions add column if not exists completed_at timestamptz;
alter table public.hero_actions add column if not exists created_at timestamptz default now();
alter table public.hero_actions add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hero_actions_hero_id_fkey'
      and conrelid = 'public.hero_actions'::regclass
  ) then
    alter table public.hero_actions
      add constraint hero_actions_hero_id_fkey
      foreign key (hero_id)
      references public.heroes(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists hero_actions_hero_idx
  on public.hero_actions(hero_id);

-- =========================================================
-- EVENTS
-- =========================================================

alter table public.events add column if not exists title text;
alter table public.events add column if not exists start_at timestamptz;
alter table public.events add column if not exists end_at timestamptz;
alter table public.events add column if not exists location text;
alter table public.events add column if not exists category text;
alter table public.events add column if not exists status text default 'draft';
alter table public.events add column if not exists max_places integer;
alter table public.events add column if not exists summary text;
alter table public.events add column if not exists body text;
alter table public.events add column if not exists public_image_url text;
alter table public.events add column if not exists booking_url text;
alter table public.events add column if not exists children_attending integer default 0;
alter table public.events add column if not exists family_reach integer default 0;
alter table public.events add column if not exists value_support numeric(10,2) default 0;
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists created_at timestamptz default now();
alter table public.events add column if not exists updated_at timestamptz default now();

create index if not exists events_status_start_idx
  on public.events(status, start_at);

-- =========================================================
-- SECURITY / SERVER ACCESS
-- =========================================================

alter table public.heroes enable row level security;
alter table public.hero_actions enable row level security;
alter table public.events enable row level security;

revoke all on table public.heroes from anon, authenticated;
revoke all on table public.hero_actions from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.heroes to service_role;
grant select, insert, update, delete on table public.hero_actions to service_role;
grant select, insert, update, delete on table public.events to service_role;

-- =========================================================
-- FORCE POSTGREST TO REFRESH
-- =========================================================

select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
select pg_notification_queue_usage();
notify pgrst, 'reload schema';

-- =========================================================
-- FINAL CHECK
-- This should return ZERO ROWS.
-- =========================================================

with required(table_name, column_name) as (
  values
    ('heroes','id'),
    ('heroes','referral_id'),
    ('heroes','child_name'),
    ('heroes','preferred_name'),
    ('heroes','date_of_birth'),
    ('heroes','postcode_prefix'),
    ('heroes','life_status'),
    ('heroes','cancer_type'),
    ('heroes','diagnosis_date_text'),
    ('heroes','journey_notes'),
    ('heroes','interests'),
    ('heroes','primary_contact_name'),
    ('heroes','primary_contact_email'),
    ('heroes','primary_contact_phone'),
    ('heroes','consent_recognition'),
    ('heroes','consent_events'),
    ('heroes','consent_updates'),
    ('heroes','consent_media_interest'),
    ('heroes','status'),
    ('heroes','admin_notes'),
    ('heroes','created_at'),
    ('heroes','updated_at'),

    ('hero_actions','id'),
    ('hero_actions','hero_id'),
    ('hero_actions','action_type'),
    ('hero_actions','title'),
    ('hero_actions','due_date'),
    ('hero_actions','status'),
    ('hero_actions','notes'),
    ('hero_actions','value_gbp'),
    ('hero_actions','completed_at'),
    ('hero_actions','created_at'),
    ('hero_actions','updated_at'),

    ('events','id'),
    ('events','title'),
    ('events','start_at'),
    ('events','end_at'),
    ('events','location'),
    ('events','category'),
    ('events','status'),
    ('events','max_places'),
    ('events','summary'),
    ('events','body'),
    ('events','public_image_url'),
    ('events','booking_url'),
    ('events','children_attending'),
    ('events','family_reach'),
    ('events','value_support'),
    ('events','published_at'),
    ('events','created_at'),
    ('events','updated_at')
)
select r.table_name, r.column_name as missing_column
from required r
left join information_schema.columns c
  on c.table_schema='public'
 and c.table_name=r.table_name
 and c.column_name=r.column_name
where c.column_name is null
order by r.table_name, r.column_name;
