create extension if not exists pgcrypto;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(), route text not null check (route in ('parent','referrer')), status text not null default 'new',
  submitter_name text, submitter_relationship text, submitter_email text, submitter_phone text,
  referrer_name text, referrer_relationship text, referrer_email text, referrer_phone text,
  child_name text not null, preferred_name text, date_of_birth date, postcode_prefix text, life_status text,
  family_contact_name text, family_contact_email text, family_contact_phone text, family_aware boolean default false, referral_reason text,
  cancer_type text, diagnosis_date_text text, journey_notes text, interests text,
  consent_heroes boolean default false, consent_health boolean default false, consent_recognition boolean default false,
  consent_events boolean default false, consent_updates boolean default false, consent_media_interest boolean default false,
  privacy_accepted boolean not null default false, contacted_at timestamptz, admin_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.heroes (
  id uuid primary key default gen_random_uuid(), referral_id uuid unique references public.referrals(id) on delete set null,
  child_name text not null, preferred_name text, date_of_birth date, postcode_prefix text, life_status text, cancer_type text,
  diagnosis_date_text text, journey_notes text, interests text, primary_contact_name text, primary_contact_email text, primary_contact_phone text,
  consent_recognition boolean default false, consent_events boolean default false, consent_updates boolean default false, consent_media_interest boolean default false,
  status text not null default 'active', admin_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.hero_actions (
  id uuid primary key default gen_random_uuid(), hero_id uuid not null references public.heroes(id) on delete cascade,
  action_type text, title text not null, due_date date, status text not null default 'open', notes text, value_gbp numeric(10,2) default 0,
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), title text not null, start_at timestamptz, end_at timestamptz, location text, category text,
  status text not null default 'draft', max_places integer, summary text, body text, public_image_url text, booking_url text,
  children_attending integer not null default 0, family_reach integer not null default 0, value_support numeric(10,2) not null default 0,
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.event_gallery (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  image_url text not null, alt_text text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.go_gold_registrations (
  id uuid primary key default gen_random_uuid(), organisation_name text not null, organisation_type text not null,
  contact_name text not null, contact_email text not null, postcode text, notes text, updates boolean default false,
  status text not null default 'new', admin_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, subject text not null, message text not null,
  status text not null default 'new', admin_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_email text not null, action text not null, entity_type text not null,
  entity_id uuid, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists heroes_status_idx on public.heroes(status);
create index if not exists hero_actions_hero_idx on public.hero_actions(hero_id);
create index if not exists events_status_start_idx on public.events(status,start_at);
create index if not exists event_gallery_event_idx on public.event_gallery(event_id);

alter table public.referrals enable row level security;
alter table public.heroes enable row level security;
alter table public.hero_actions enable row level security;
alter table public.events enable row level security;
alter table public.event_gallery enable row level security;
alter table public.go_gold_registrations enable row level security;
alter table public.contacts enable row level security;
alter table public.audit_log enable row level security;

-- No anon/authenticated policies are intentionally created. The browser never talks directly to these tables.
-- Server-side Vercel functions use the Supabase service-role key and bypass RLS.
