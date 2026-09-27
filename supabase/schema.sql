-- Project Golden Child v1 database schema
-- Run in a dedicated Supabase project. Public clients should never be given direct table access.
create extension if not exists pgcrypto;

create table if not exists public.referrals (
  id text primary key,
  route text not null check (route in ('parent','referrer')),
  status text not null default 'new' check (status in ('new','contacted','awaiting-family','approved','declined','closed')),
  child_name text,
  preferred_name text,
  date_of_birth date,
  postcode_prefix text,
  life_status text,
  cancer_type text,
  diagnosis_date_text text,
  journey_notes text,
  interests text,
  submitter_name text not null,
  submitter_relationship text,
  submitter_email text not null,
  submitter_phone text,
  family_contact_name text,
  family_contact_email text,
  family_contact_phone text,
  family_aware boolean not null default false,
  referral_reason text,
  consents jsonb not null default '{}'::jsonb,
  privacy_accepted boolean not null default false,
  source_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.heroes (
  id text primary key,
  referral_id text unique references public.referrals(id) on delete restrict,
  child_name text not null,
  preferred_name text,
  date_of_birth date,
  postcode_prefix text,
  life_status text,
  cancer_type text,
  diagnosis_date_text text,
  interests text,
  family_contact_name text,
  family_contact_email text,
  family_contact_phone text,
  consents jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','remembered','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hero_actions (
  id text primary key,
  hero_id text not null references public.heroes(id) on delete cascade,
  action_type text not null check (action_type in ('welcome_pack','recognition','gift','meal','family_contact','event','other')),
  title text not null,
  due_date date,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  notes text,
  value_provided numeric(12,2) not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  title text not null,
  slug text unique not null,
  summary text,
  body text,
  start_at timestamptz,
  end_at timestamptz,
  location text,
  category text,
  status text not null default 'draft' check (status in ('draft','published','completed','archived','cancelled')),
  hero_image_url text,
  max_places integer,
  booking_url text,
  attendance_children integer not null default 0,
  attendance_family integer not null default 0,
  value_provided numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.event_media (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  public_approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.go_gold_pledges (
  id text primary key,
  organisation_name text not null,
  organisation_type text,
  contact_name text not null,
  contact_email text not null,
  postcode text,
  notes text,
  updates boolean not null default false,
  status text not null default 'interested',
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id text primary key,
  name text not null,
  email text not null,
  subject text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists referrals_created_at_idx on public.referrals(created_at desc);
create index if not exists heroes_status_idx on public.heroes(status);
create index if not exists hero_actions_hero_idx on public.hero_actions(hero_id);
create index if not exists hero_actions_due_idx on public.hero_actions(status,due_date);
create index if not exists events_start_at_idx on public.events(start_at);
create index if not exists events_status_idx on public.events(status);
create index if not exists audit_created_at_idx on public.audit_log(created_at desc);

-- Deny direct browser access. The website uses server-side service credentials only.
alter table public.referrals enable row level security;
alter table public.heroes enable row level security;
alter table public.hero_actions enable row level security;
alter table public.events enable row level security;
alter table public.event_media enable row level security;
alter table public.go_gold_pledges enable row level security;
alter table public.contact_messages enable row level security;
alter table public.audit_log enable row level security;

-- Do not add anon/authenticated policies to sensitive tables. Service role bypasses RLS.
-- For the public event feed, the server API reads and returns only published/completed fields.

-- Create a PUBLIC storage bucket named `event-public` manually in Supabase Storage.
-- Only upload photographs which have already passed the relevant media-consent check.
