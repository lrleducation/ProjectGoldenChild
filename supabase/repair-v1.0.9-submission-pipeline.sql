-- Project Golden Child v1.0.9 submission-pipeline repair
-- Safe to run more than once. It does not delete or overwrite existing records.

create extension if not exists pgcrypto;

-- Ensure the core submission tables exist. Existing tables are left in place.
create table if not exists public.referrals (
  id text primary key default gen_random_uuid()::text,
  route text not null default 'parent', status text not null default 'new', child_name text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.go_gold_registrations (
  id text primary key default gen_random_uuid()::text,
  organisation_name text not null default '', organisation_type text not null default '', contact_name text not null default '', contact_email text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contacts (
  id text primary key default gen_random_uuid()::text,
  name text not null default '', email text not null default '', subject text not null default '', message text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  actor_email text not null default 'public', action text not null default '', entity_type text not null default '', entity_id text, detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Add any columns required by the current public forms. This is important when an older table already existed,
-- because CREATE TABLE IF NOT EXISTS does not add later columns.
alter table public.referrals add column if not exists route text;
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

alter table public.go_gold_registrations add column if not exists postcode text;
alter table public.go_gold_registrations add column if not exists notes text;
alter table public.go_gold_registrations add column if not exists updates boolean default false;
alter table public.go_gold_registrations add column if not exists status text default 'new';
alter table public.go_gold_registrations add column if not exists admin_notes text;
alter table public.go_gold_registrations add column if not exists created_at timestamptz default now();
alter table public.go_gold_registrations add column if not exists updated_at timestamptz default now();

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

-- Keep the family/health tables inaccessible to browser roles.
alter table public.referrals enable row level security;
alter table public.go_gold_registrations enable row level security;
alter table public.contacts enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.referrals from anon, authenticated;
revoke all on table public.go_gold_registrations from anon, authenticated;
revoke all on table public.contacts from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

-- IMPORTANT FOR NEW SUPABASE PROJECTS (2026+): Data API access is no longer automatically granted.
-- The server-side secret key maps to service_role, so explicitly grant only that role access.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.referrals to service_role;
grant select, insert, update, delete on table public.go_gold_registrations to service_role;
grant select, insert, update, delete on table public.contacts to service_role;
grant select, insert, update, delete on table public.audit_log to service_role;

-- Also repair grants for the private admin/event tables when present.
do $$
begin
  if to_regclass('public.heroes') is not null then execute 'revoke all on table public.heroes from anon, authenticated'; execute 'grant select, insert, update, delete on table public.heroes to service_role'; end if;
  if to_regclass('public.hero_actions') is not null then execute 'revoke all on table public.hero_actions from anon, authenticated'; execute 'grant select, insert, update, delete on table public.hero_actions to service_role'; end if;
  if to_regclass('public.events') is not null then execute 'revoke all on table public.events from anon, authenticated'; execute 'grant select, insert, update, delete on table public.events to service_role'; end if;
  if to_regclass('public.event_gallery') is not null then execute 'revoke all on table public.event_gallery from anon, authenticated'; execute 'grant select, insert, update, delete on table public.event_gallery to service_role'; end if;
end $$;

-- Future PGC tables created by postgres remain reachable to server-side service_role only when explicitly granted.
-- Reload PostgREST's schema cache after structural changes.
notify pgrst, 'reload schema';
