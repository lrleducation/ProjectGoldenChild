-- =====================================================================
-- PROJECT GOLDEN CHILD — FINAL SUPABASE SETUP
-- Version 2.0.0
--
-- This is the one canonical database setup for the website.
-- It deliberately creates NEW pgc_* tables so the live application no
-- longer depends on any older partially-migrated tables.
--
-- Existing legacy tables are NOT dropped.
-- The live v2.0.0 code uses only the pgc_* tables below.
-- Safe to run repeatedly.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Canonical schema version
-- ---------------------------------------------------------------------

create table if not exists public.pgc_schema_meta (
  version text primary key,
  applied_at timestamptz not null default now()
);

insert into public.pgc_schema_meta(version,applied_at)
values ('2.0.0',now())
on conflict (version) do update set applied_at=excluded.applied_at;

-- ---------------------------------------------------------------------
-- 2. Canonical tables
-- ---------------------------------------------------------------------

create table if not exists public.pgc_referrals (
  id text primary key default gen_random_uuid()::text,
  route text,
  status text default 'new',

  submitter_name text,
  submitter_relationship text,
  submitter_email text,
  submitter_phone text,

  referrer_name text,
  referrer_relationship text,
  referrer_email text,
  referrer_phone text,

  child_name text,
  preferred_name text,
  date_of_birth date,
  postcode_prefix text,
  life_status text,

  family_contact_name text,
  family_contact_email text,
  family_contact_phone text,
  family_aware boolean default false,

  referral_reason text,

  cancer_type text,
  diagnosis_date_text text,
  journey_notes text,
  interests text,

  consent_heroes boolean default false,
  consent_health boolean default false,
  consent_recognition boolean default false,
  consent_events boolean default false,
  consent_updates boolean default false,
  consent_media_interest boolean default false,
  privacy_accepted boolean default false,

  contacted_at timestamptz,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_heroes (
  id text primary key default gen_random_uuid()::text,
  referral_id text unique references public.pgc_referrals(id) on delete set null,

  child_name text,
  preferred_name text,
  date_of_birth date,
  postcode_prefix text,
  life_status text,
  cancer_type text,
  diagnosis_date_text text,
  journey_notes text,
  interests text,

  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,

  consent_recognition boolean default false,
  consent_events boolean default false,
  consent_updates boolean default false,
  consent_media_interest boolean default false,

  status text default 'active',
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_hero_actions (
  id text primary key default gen_random_uuid()::text,
  hero_id text references public.pgc_heroes(id) on delete cascade,

  action_type text,
  title text,
  due_date date,
  status text default 'open',
  notes text,
  value_gbp numeric(10,2) default 0,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_events (
  id text primary key default gen_random_uuid()::text,

  title text,
  start_at timestamptz,
  end_at timestamptz,
  location text,
  category text,
  status text default 'draft',
  max_places integer,
  summary text,
  body text,
  public_image_url text,
  booking_url text,

  children_attending integer default 0,
  family_reach integer default 0,
  value_support numeric(10,2) default 0,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_event_gallery (
  id text primary key default gen_random_uuid()::text,
  event_id text references public.pgc_events(id) on delete cascade,

  image_url text,
  alt_text text,
  sort_order integer default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_go_gold_registrations (
  id text primary key default gen_random_uuid()::text,

  organisation_name text,
  organisation_type text,
  contact_name text,
  contact_email text,
  postcode text,
  notes text,
  updates boolean default false,

  status text default 'new',
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_contacts (
  id text primary key default gen_random_uuid()::text,

  name text,
  email text,
  subject text,
  message text,

  status text default 'new',
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pgc_audit_log (
  id text primary key default gen_random_uuid()::text,

  actor_email text,
  action text,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedicated non-personal table used by the admin System Health write test.
create table if not exists public.pgc_healthcheck (
  id text primary key,
  checked_at timestamptz not null default now(),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------

create index if not exists pgc_referrals_status_idx
  on public.pgc_referrals(status);

create index if not exists pgc_referrals_created_idx
  on public.pgc_referrals(created_at desc);

create index if not exists pgc_heroes_status_idx
  on public.pgc_heroes(status);

create index if not exists pgc_hero_actions_hero_idx
  on public.pgc_hero_actions(hero_id);

create index if not exists pgc_hero_actions_status_idx
  on public.pgc_hero_actions(status);

create index if not exists pgc_events_status_start_idx
  on public.pgc_events(status,start_at);

create index if not exists pgc_event_gallery_event_idx
  on public.pgc_event_gallery(event_id,sort_order);

create index if not exists pgc_go_gold_created_idx
  on public.pgc_go_gold_registrations(created_at desc);

create index if not exists pgc_contacts_created_idx
  on public.pgc_contacts(created_at desc);

create index if not exists pgc_audit_created_idx
  on public.pgc_audit_log(created_at desc);

-- ---------------------------------------------------------------------
-- 4. RLS and explicit Data API permissions
-- ---------------------------------------------------------------------

alter table public.pgc_schema_meta enable row level security;
alter table public.pgc_referrals enable row level security;
alter table public.pgc_heroes enable row level security;
alter table public.pgc_hero_actions enable row level security;
alter table public.pgc_events enable row level security;
alter table public.pgc_event_gallery enable row level security;
alter table public.pgc_go_gold_registrations enable row level security;
alter table public.pgc_contacts enable row level security;
alter table public.pgc_audit_log enable row level security;
alter table public.pgc_healthcheck enable row level security;

revoke all on table
  public.pgc_schema_meta,
  public.pgc_referrals,
  public.pgc_heroes,
  public.pgc_hero_actions,
  public.pgc_events,
  public.pgc_event_gallery,
  public.pgc_go_gold_registrations,
  public.pgc_contacts,
  public.pgc_audit_log,
  public.pgc_healthcheck
from anon, authenticated;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.pgc_schema_meta,
  public.pgc_referrals,
  public.pgc_heroes,
  public.pgc_hero_actions,
  public.pgc_events,
  public.pgc_event_gallery,
  public.pgc_go_gold_registrations,
  public.pgc_contacts,
  public.pgc_audit_log,
  public.pgc_healthcheck
to service_role;

-- ---------------------------------------------------------------------
-- 5. Event image bucket
-- ---------------------------------------------------------------------
-- The application uploads only administrator-approved public event images.
-- The server uses the Supabase secret key for uploads.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-public',
  'event-public',
  true,
  3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 6. Optional best-effort copy from legacy Project Golden Child tables
-- ---------------------------------------------------------------------
-- This never drops or changes the old tables.
-- It copies only columns that exist in both old and new tables.
-- If a legacy table has incompatible column types, that table is skipped
-- and the old data remains untouched.

do $$
declare
  pair record;
  cols text;
begin
  for pair in
    select *
    from (
      values
        ('referrals','pgc_referrals'),
        ('heroes','pgc_heroes'),
        ('hero_actions','pgc_hero_actions'),
        ('events','pgc_events'),
        ('event_gallery','pgc_event_gallery'),
        ('go_gold_registrations','pgc_go_gold_registrations'),
        ('contacts','pgc_contacts'),
        ('audit_log','pgc_audit_log')
    ) as x(source_table,target_table)
  loop
    if to_regclass(format('public.%I',pair.source_table)) is not null then
      select string_agg(format('%I',target.column_name), ', ' order by target.ordinal_position)
      into cols
      from information_schema.columns target
      join information_schema.columns source
        on source.table_schema='public'
       and source.table_name=pair.source_table
       and source.column_name=target.column_name
      where target.table_schema='public'
        and target.table_name=pair.target_table;

      if cols is not null then
        begin
          execute format(
            'insert into public.%I (%s) select %s from public.%I on conflict (id) do nothing',
            pair.target_table,
            cols,
            cols,
            pair.source_table
          );
        exception when others then
          raise notice 'Legacy copy for % skipped safely: %',pair.source_table,sqlerrm;
        end;
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Refresh PostgREST
-- ---------------------------------------------------------------------

select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
select pg_notification_queue_usage();
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 8. SQL-level write smoke test
-- ---------------------------------------------------------------------

insert into public.pgc_healthcheck(id,checked_at,source)
values ('sql-v2-smoke-test',now(),'supabase-sql-editor')
on conflict (id) do update
set checked_at=excluded.checked_at,
    source=excluded.source,
    updated_at=now();

delete from public.pgc_healthcheck
where id='sql-v2-smoke-test';

-- ---------------------------------------------------------------------
-- 9. FINAL VERIFICATION
--
-- EXPECTED RESULT:
-- ZERO ROWS.
-- If this query returns zero rows, every v2 application column exists.
-- ---------------------------------------------------------------------

with required(table_name,column_name) as (
  values
    ('pgc_schema_meta','version'),
    ('pgc_schema_meta','applied_at'),

    ('pgc_referrals','id'),
    ('pgc_referrals','route'),
    ('pgc_referrals','status'),
    ('pgc_referrals','submitter_name'),
    ('pgc_referrals','submitter_relationship'),
    ('pgc_referrals','submitter_email'),
    ('pgc_referrals','submitter_phone'),
    ('pgc_referrals','referrer_name'),
    ('pgc_referrals','referrer_relationship'),
    ('pgc_referrals','referrer_email'),
    ('pgc_referrals','referrer_phone'),
    ('pgc_referrals','child_name'),
    ('pgc_referrals','preferred_name'),
    ('pgc_referrals','date_of_birth'),
    ('pgc_referrals','postcode_prefix'),
    ('pgc_referrals','life_status'),
    ('pgc_referrals','family_contact_name'),
    ('pgc_referrals','family_contact_email'),
    ('pgc_referrals','family_contact_phone'),
    ('pgc_referrals','family_aware'),
    ('pgc_referrals','referral_reason'),
    ('pgc_referrals','cancer_type'),
    ('pgc_referrals','diagnosis_date_text'),
    ('pgc_referrals','journey_notes'),
    ('pgc_referrals','interests'),
    ('pgc_referrals','consent_heroes'),
    ('pgc_referrals','consent_health'),
    ('pgc_referrals','consent_recognition'),
    ('pgc_referrals','consent_events'),
    ('pgc_referrals','consent_updates'),
    ('pgc_referrals','consent_media_interest'),
    ('pgc_referrals','privacy_accepted'),
    ('pgc_referrals','contacted_at'),
    ('pgc_referrals','admin_notes'),
    ('pgc_referrals','created_at'),
    ('pgc_referrals','updated_at'),

    ('pgc_heroes','id'),
    ('pgc_heroes','referral_id'),
    ('pgc_heroes','child_name'),
    ('pgc_heroes','preferred_name'),
    ('pgc_heroes','date_of_birth'),
    ('pgc_heroes','postcode_prefix'),
    ('pgc_heroes','life_status'),
    ('pgc_heroes','cancer_type'),
    ('pgc_heroes','diagnosis_date_text'),
    ('pgc_heroes','journey_notes'),
    ('pgc_heroes','interests'),
    ('pgc_heroes','primary_contact_name'),
    ('pgc_heroes','primary_contact_email'),
    ('pgc_heroes','primary_contact_phone'),
    ('pgc_heroes','consent_recognition'),
    ('pgc_heroes','consent_events'),
    ('pgc_heroes','consent_updates'),
    ('pgc_heroes','consent_media_interest'),
    ('pgc_heroes','status'),
    ('pgc_heroes','admin_notes'),
    ('pgc_heroes','created_at'),
    ('pgc_heroes','updated_at'),

    ('pgc_hero_actions','id'),
    ('pgc_hero_actions','hero_id'),
    ('pgc_hero_actions','action_type'),
    ('pgc_hero_actions','title'),
    ('pgc_hero_actions','due_date'),
    ('pgc_hero_actions','status'),
    ('pgc_hero_actions','notes'),
    ('pgc_hero_actions','value_gbp'),
    ('pgc_hero_actions','completed_at'),
    ('pgc_hero_actions','created_at'),
    ('pgc_hero_actions','updated_at'),

    ('pgc_events','id'),
    ('pgc_events','title'),
    ('pgc_events','start_at'),
    ('pgc_events','end_at'),
    ('pgc_events','location'),
    ('pgc_events','category'),
    ('pgc_events','status'),
    ('pgc_events','max_places'),
    ('pgc_events','summary'),
    ('pgc_events','body'),
    ('pgc_events','public_image_url'),
    ('pgc_events','booking_url'),
    ('pgc_events','children_attending'),
    ('pgc_events','family_reach'),
    ('pgc_events','value_support'),
    ('pgc_events','published_at'),
    ('pgc_events','created_at'),
    ('pgc_events','updated_at'),

    ('pgc_event_gallery','id'),
    ('pgc_event_gallery','event_id'),
    ('pgc_event_gallery','image_url'),
    ('pgc_event_gallery','alt_text'),
    ('pgc_event_gallery','sort_order'),
    ('pgc_event_gallery','created_at'),
    ('pgc_event_gallery','updated_at'),

    ('pgc_go_gold_registrations','id'),
    ('pgc_go_gold_registrations','organisation_name'),
    ('pgc_go_gold_registrations','organisation_type'),
    ('pgc_go_gold_registrations','contact_name'),
    ('pgc_go_gold_registrations','contact_email'),
    ('pgc_go_gold_registrations','postcode'),
    ('pgc_go_gold_registrations','notes'),
    ('pgc_go_gold_registrations','updates'),
    ('pgc_go_gold_registrations','status'),
    ('pgc_go_gold_registrations','admin_notes'),
    ('pgc_go_gold_registrations','created_at'),
    ('pgc_go_gold_registrations','updated_at'),

    ('pgc_contacts','id'),
    ('pgc_contacts','name'),
    ('pgc_contacts','email'),
    ('pgc_contacts','subject'),
    ('pgc_contacts','message'),
    ('pgc_contacts','status'),
    ('pgc_contacts','admin_notes'),
    ('pgc_contacts','created_at'),
    ('pgc_contacts','updated_at'),

    ('pgc_audit_log','id'),
    ('pgc_audit_log','actor_email'),
    ('pgc_audit_log','action'),
    ('pgc_audit_log','entity_type'),
    ('pgc_audit_log','entity_id'),
    ('pgc_audit_log','detail'),
    ('pgc_audit_log','created_at'),
    ('pgc_audit_log','updated_at'),

    ('pgc_healthcheck','id'),
    ('pgc_healthcheck','checked_at'),
    ('pgc_healthcheck','source'),
    ('pgc_healthcheck','created_at'),
    ('pgc_healthcheck','updated_at')
)
select
  required.table_name,
  required.column_name as missing_column
from required
left join information_schema.columns actual
  on actual.table_schema='public'
 and actual.table_name=required.table_name
 and actual.column_name=required.column_name
where actual.column_name is null
order by required.table_name,required.column_name;


-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.1.0 UPDATE
-- Communications + final admin controls
--
-- Run this ONCE against a database already using v2.0.0.
-- Safe to run repeatedly. Existing records are not deleted.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.pgc_communications (
  id text primary key default gen_random_uuid()::text,

  hero_id text references public.pgc_heroes(id) on delete set null,
  referral_id text references public.pgc_referrals(id) on delete set null,

  direction text not null default 'outbound',
  method text not null default 'Email',

  contact_name text,
  contact_email text,
  contact_phone text,

  subject text not null,
  notes text not null,
  outcome text,

  occurred_at timestamptz not null default now(),
  follow_up_date date,
  created_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pgc_communications_occurred_idx
  on public.pgc_communications(occurred_at desc);

create index if not exists pgc_communications_hero_idx
  on public.pgc_communications(hero_id);

create index if not exists pgc_communications_referral_idx
  on public.pgc_communications(referral_id);

alter table public.pgc_communications enable row level security;

revoke all on table public.pgc_communications from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete
  on table public.pgc_communications
  to service_role;

insert into public.pgc_schema_meta(version,applied_at)
values ('2.1.0',clock_timestamp())
on conflict (version) do update
set applied_at=excluded.applied_at;

-- Refresh Supabase/PostgREST so the new table is immediately visible.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
select pg_notification_queue_usage();
notify pgrst, 'reload schema';

-- FINAL CHECK
-- Expected result: ZERO ROWS.
with required(table_name,column_name) as (
  values
    ('pgc_communications','id'),
    ('pgc_communications','hero_id'),
    ('pgc_communications','referral_id'),
    ('pgc_communications','direction'),
    ('pgc_communications','method'),
    ('pgc_communications','contact_name'),
    ('pgc_communications','contact_email'),
    ('pgc_communications','contact_phone'),
    ('pgc_communications','subject'),
    ('pgc_communications','notes'),
    ('pgc_communications','outcome'),
    ('pgc_communications','occurred_at'),
    ('pgc_communications','follow_up_date'),
    ('pgc_communications','created_by'),
    ('pgc_communications','created_at'),
    ('pgc_communications','updated_at')
)
select
  required.table_name,
  required.column_name as missing_column
from required
left join information_schema.columns actual
  on actual.table_schema='public'
 and actual.table_name=required.table_name
 and actual.column_name=required.column_name
where actual.column_name is null
order by required.column_name;
