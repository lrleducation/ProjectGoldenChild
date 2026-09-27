-- Project Golden Child v1.0.10
-- Submission schema compatibility + PostgREST cache repair
-- Safe to run repeatedly. Does not delete existing records.

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. Ensure public submission tables exist
-- =====================================================================

create table if not exists public.referrals (
  id text primary key default gen_random_uuid()::text,
  route text not null default 'parent',
  status text not null default 'new',
  child_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.go_gold_registrations (
  id text primary key default gen_random_uuid()::text,
  organisation_name text not null default '',
  organisation_type text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id text primary key default gen_random_uuid()::text,
  name text not null default '',
  email text not null default '',
  subject text not null default '',
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  actor_email text not null default 'public',
  action text not null default '',
  entity_type text not null default '',
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2. Ensure every field used by the referral form/API exists
-- =====================================================================

alter table public.referrals add column if not exists route text default 'parent';
alter table public.referrals add column if not exists status text default 'new';
alter table public.referrals add column if not exists submitter_name text;
alter table public.referrals add column if not exists submitter_relationship text;
alter table public.referrals add column if not exists submitter_email text;
alter table public.referrals add column if not exists submitter_phone text;
alter table public.referrals add column if not exists referrer_name text;
alter table public.referrals add column if not exists referrer_relationship text;
alter table public.referrals add column if not exists referrer_email text;
alter table public.referrals add column if not exists referrer_phone text;
alter table public.referrals add column if not exists child_name text;
alter table public.referrals add column if not exists preferred_name text;
alter table public.referrals add column if not exists date_of_birth date;
alter table public.referrals add column if not exists postcode_prefix text;
alter table public.referrals add column if not exists life_status text;
alter table public.referrals add column if not exists family_contact_name text;
alter table public.referrals add column if not exists family_contact_email text;
alter table public.referrals add column if not exists family_contact_phone text;
alter table public.referrals add column if not exists family_aware boolean default false;
alter table public.referrals add column if not exists referral_reason text;
alter table public.referrals add column if not exists cancer_type text;
alter table public.referrals add column if not exists diagnosis_date_text text;
alter table public.referrals add column if not exists journey_notes text;
alter table public.referrals add column if not exists interests text;
alter table public.referrals add column if not exists consent_heroes boolean default false;
alter table public.referrals add column if not exists consent_health boolean default false;
alter table public.referrals add column if not exists consent_recognition boolean default false;
alter table public.referrals add column if not exists consent_events boolean default false;
alter table public.referrals add column if not exists consent_updates boolean default false;
alter table public.referrals add column if not exists consent_media_interest boolean default false;
alter table public.referrals add column if not exists privacy_accepted boolean default false;
alter table public.referrals add column if not exists contacted_at timestamptz;
alter table public.referrals add column if not exists admin_notes text;
alter table public.referrals add column if not exists created_at timestamptz default now();
alter table public.referrals add column if not exists updated_at timestamptz default now();

-- =====================================================================
-- 3. Ensure every field used by Go Gold and Contact forms exists
-- =====================================================================

alter table public.go_gold_registrations add column if not exists organisation_name text;
alter table public.go_gold_registrations add column if not exists organisation_type text;
alter table public.go_gold_registrations add column if not exists contact_name text;
alter table public.go_gold_registrations add column if not exists contact_email text;
alter table public.go_gold_registrations add column if not exists postcode text;
alter table public.go_gold_registrations add column if not exists notes text;
alter table public.go_gold_registrations add column if not exists updates boolean default false;
alter table public.go_gold_registrations add column if not exists status text default 'new';
alter table public.go_gold_registrations add column if not exists admin_notes text;
alter table public.go_gold_registrations add column if not exists created_at timestamptz default now();
alter table public.go_gold_registrations add column if not exists updated_at timestamptz default now();

alter table public.contacts add column if not exists name text;
alter table public.contacts add column if not exists email text;
alter table public.contacts add column if not exists subject text;
alter table public.contacts add column if not exists message text;
alter table public.contacts add column if not exists status text default 'new';
alter table public.contacts add column if not exists admin_notes text;
alter table public.contacts add column if not exists created_at timestamptz default now();
alter table public.contacts add column if not exists updated_at timestamptz default now();

alter table public.audit_log add column if not exists actor_email text default 'public';
alter table public.audit_log add column if not exists action text;
alter table public.audit_log add column if not exists entity_type text;
alter table public.audit_log add column if not exists entity_id text;
alter table public.audit_log add column if not exists detail jsonb default '{}'::jsonb;
alter table public.audit_log add column if not exists created_at timestamptz default now();
alter table public.audit_log add column if not exists updated_at timestamptz default now();

-- =====================================================================
-- 4. Secure the tables and grant server-side access
-- =====================================================================

alter table public.referrals enable row level security;
alter table public.go_gold_registrations enable row level security;
alter table public.contacts enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.referrals from anon, authenticated;
revoke all on table public.go_gold_registrations from anon, authenticated;
revoke all on table public.contacts from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.referrals to service_role;
grant select, insert, update, delete on table public.go_gold_registrations to service_role;
grant select, insert, update, delete on table public.contacts to service_role;
grant select, insert, update, delete on table public.audit_log to service_role;

-- =====================================================================
-- 5. Force PostgREST to see the new/changed columns
-- =====================================================================
-- Supabase specifically recommends touching the notification queue when
-- PostgREST continues to report stale columns after DDL changes.

select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
select pg_notification_queue_usage();
notify pgrst, 'reload schema';

-- =====================================================================
-- 6. Final verification: this should return ZERO ROWS
-- =====================================================================

with required(table_name,column_name) as (
  values
  ('referrals','id'),('referrals','route'),('referrals','status'),
  ('referrals','submitter_name'),('referrals','submitter_relationship'),('referrals','submitter_email'),
  ('referrals','submitter_phone'),('referrals','referrer_name'),('referrals','referrer_relationship'),
  ('referrals','referrer_email'),('referrals','referrer_phone'),('referrals','child_name'),
  ('referrals','preferred_name'),('referrals','date_of_birth'),('referrals','postcode_prefix'),
  ('referrals','life_status'),('referrals','family_contact_name'),('referrals','family_contact_email'),
  ('referrals','family_contact_phone'),('referrals','family_aware'),('referrals','referral_reason'),
  ('referrals','cancer_type'),('referrals','diagnosis_date_text'),('referrals','journey_notes'),
  ('referrals','interests'),('referrals','consent_heroes'),('referrals','consent_health'),
  ('referrals','consent_recognition'),('referrals','consent_events'),('referrals','consent_updates'),
  ('referrals','consent_media_interest'),('referrals','privacy_accepted'),('referrals','contacted_at'),
  ('referrals','admin_notes'),('referrals','created_at'),('referrals','updated_at'),
  ('go_gold_registrations','id'),('go_gold_registrations','organisation_name'),
  ('go_gold_registrations','organisation_type'),('go_gold_registrations','contact_name'),
  ('go_gold_registrations','contact_email'),('go_gold_registrations','postcode'),
  ('go_gold_registrations','notes'),('go_gold_registrations','updates'),
  ('go_gold_registrations','status'),('go_gold_registrations','admin_notes'),
  ('go_gold_registrations','created_at'),('go_gold_registrations','updated_at'),
  ('contacts','id'),('contacts','name'),('contacts','email'),('contacts','subject'),
  ('contacts','message'),('contacts','status'),('contacts','admin_notes'),
  ('contacts','created_at'),('contacts','updated_at')
)
select r.table_name, r.column_name as missing_column
from required r
left join information_schema.columns c
  on c.table_schema='public'
 and c.table_name=r.table_name
 and c.column_name=r.column_name
where c.column_name is null
order by r.table_name,r.column_name;
