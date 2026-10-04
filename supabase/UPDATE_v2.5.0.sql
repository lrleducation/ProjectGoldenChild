-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.5.0
-- CRACLL workflow enhancements: direct communications, appointments,
-- reminders, family delivery addresses and dashboard follow-up controls.
-- Safe to run repeatedly. Existing data is retained.
-- =====================================================================

create extension if not exists pgcrypto;

-- Family delivery address. Collected only from direct parent/carer registration.
alter table public.pgc_referrals add column if not exists address_line_1 text;
alter table public.pgc_referrals add column if not exists address_line_2 text;
alter table public.pgc_referrals add column if not exists town_city text;
alter table public.pgc_referrals add column if not exists county text;
alter table public.pgc_referrals add column if not exists postcode text;

alter table public.pgc_heroes add column if not exists address_line_1 text;
alter table public.pgc_heroes add column if not exists address_line_2 text;
alter table public.pgc_heroes add column if not exists town_city text;
alter table public.pgc_heroes add column if not exists county text;
alter table public.pgc_heroes add column if not exists postcode text;

-- Extend the communication log so it also acts as a delivery audit trail.
alter table public.pgc_communications add column if not exists send_status text default 'logged';
alter table public.pgc_communications add column if not exists provider_message_id text;
alter table public.pgc_communications add column if not exists error_text text;
alter table public.pgc_communications add column if not exists sent_at timestamptz;
alter table public.pgc_communications add column if not exists send_batch_id text;
alter table public.pgc_communications add column if not exists follow_up_completed_at timestamptz;

create index if not exists pgc_communications_follow_up_idx
  on public.pgc_communications(follow_up_date);
create index if not exists pgc_communications_batch_idx
  on public.pgc_communications(send_batch_id);

-- Appointments/reviews calendar, adapted from the CRACLL operational model.
create table if not exists public.pgc_appointments (
  id text primary key default gen_random_uuid()::text,
  hero_id text references public.pgc_heroes(id) on delete set null,
  referral_id text references public.pgc_referrals(id) on delete set null,
  appointment_type text not null default 'Family contact',
  title text not null,
  meeting_with text not null,
  contact_email text,
  location text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  notes text,
  status text not null default 'scheduled',
  reminder_admin boolean not null default true,
  reminder_family boolean not null default false,
  reminder_24h boolean not null default true,
  reminder_morning boolean not null default true,
  reminder_30m boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pgc_appointments_start_idx on public.pgc_appointments(start_at);
create index if not exists pgc_appointments_hero_idx on public.pgc_appointments(hero_id);
create index if not exists pgc_appointments_referral_idx on public.pgc_appointments(referral_id);

create table if not exists public.pgc_appointment_reminders (
  id text primary key default gen_random_uuid()::text,
  appointment_id text not null references public.pgc_appointments(id) on delete cascade,
  reminder_type text not null,
  recipient_email text not null,
  recipient_name text,
  recipient_kind text,
  status text not null default 'pending',
  scheduled_for timestamptz,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pgc_appointment_reminders_unique_idx
  on public.pgc_appointment_reminders(appointment_id,reminder_type,recipient_email);
create index if not exists pgc_appointment_reminders_schedule_idx
  on public.pgc_appointment_reminders(scheduled_for,status);

alter table public.pgc_appointments enable row level security;
alter table public.pgc_appointment_reminders enable row level security;
revoke all on table public.pgc_appointments, public.pgc_appointment_reminders from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.pgc_appointments, public.pgc_appointment_reminders to service_role;

insert into public.pgc_schema_meta(version,applied_at)
values ('2.5.0',clock_timestamp())
on conflict (version) do update set applied_at=excluded.applied_at;

notify pgrst, 'reload schema';

-- FINAL CHECK — expected result: ZERO ROWS.
with required(table_name,column_name) as (
  values
    ('pgc_referrals','address_line_1'),('pgc_referrals','address_line_2'),('pgc_referrals','town_city'),('pgc_referrals','county'),('pgc_referrals','postcode'),
    ('pgc_heroes','address_line_1'),('pgc_heroes','address_line_2'),('pgc_heroes','town_city'),('pgc_heroes','county'),('pgc_heroes','postcode'),
    ('pgc_communications','send_status'),('pgc_communications','provider_message_id'),('pgc_communications','error_text'),('pgc_communications','sent_at'),('pgc_communications','send_batch_id'),('pgc_communications','follow_up_completed_at'),
    ('pgc_appointments','id'),('pgc_appointments','hero_id'),('pgc_appointments','referral_id'),('pgc_appointments','appointment_type'),('pgc_appointments','title'),('pgc_appointments','meeting_with'),('pgc_appointments','contact_email'),('pgc_appointments','location'),('pgc_appointments','start_at'),('pgc_appointments','end_at'),('pgc_appointments','notes'),('pgc_appointments','status'),('pgc_appointments','reminder_admin'),('pgc_appointments','reminder_family'),('pgc_appointments','reminder_24h'),('pgc_appointments','reminder_morning'),('pgc_appointments','reminder_30m'),('pgc_appointments','created_by'),('pgc_appointments','updated_by'),('pgc_appointments','created_at'),('pgc_appointments','updated_at'),
    ('pgc_appointment_reminders','id'),('pgc_appointment_reminders','appointment_id'),('pgc_appointment_reminders','reminder_type'),('pgc_appointment_reminders','recipient_email'),('pgc_appointment_reminders','recipient_name'),('pgc_appointment_reminders','recipient_kind'),('pgc_appointment_reminders','status'),('pgc_appointment_reminders','scheduled_for'),('pgc_appointment_reminders','provider_message_id'),('pgc_appointment_reminders','error'),('pgc_appointment_reminders','sent_at'),('pgc_appointment_reminders','created_at'),('pgc_appointment_reminders','updated_at')
)
select required.table_name,required.column_name as missing_column
from required
left join information_schema.columns actual
  on actual.table_schema='public' and actual.table_name=required.table_name and actual.column_name=required.column_name
where actual.column_name is null
order by required.table_name,required.column_name;
