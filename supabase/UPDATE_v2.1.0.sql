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
