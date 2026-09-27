-- Project Golden Child v1.0.4
-- Repair for a database where public.events.id is TEXT.
-- The v1.0.3 schema incorrectly tried to create event_gallery.event_id as UUID.

create extension if not exists pgcrypto;

create table if not exists public.event_gallery (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.go_gold_registrations (
  id text primary key default gen_random_uuid()::text,
  organisation_name text not null,
  organisation_type text not null,
  contact_name text not null,
  contact_email text not null,
  postcode text,
  notes text,
  updates boolean default false,
  status text not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_gallery_event_idx on public.event_gallery(event_id);

alter table public.event_gallery enable row level security;
alter table public.go_gold_registrations enable row level security;
alter table public.contacts enable row level security;
alter table public.audit_log enable row level security;
