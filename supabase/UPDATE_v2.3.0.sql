-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.3.0
-- Event reviews, photography and AI-assisted drafting
-- Safe to run repeatedly. Existing event data is retained.
-- =====================================================================

alter table public.pgc_events
  add column if not exists people_attending integer default 0;

alter table public.pgc_events
  add column if not exists families_attending integer default 0;

alter table public.pgc_events
  add column if not exists volunteers_attending integer default 0;

alter table public.pgc_events
  add column if not exists photo_consent_confirmed boolean default false;

alter table public.pgc_events
  add column if not exists photo_consent_note text;

alter table public.pgc_events
  add column if not exists photo_consent_confirmed_at timestamptz;

alter table public.pgc_events
  add column if not exists photo_consent_confirmed_by text;

alter table public.pgc_events
  add column if not exists review_status text default 'draft';

alter table public.pgc_events
  add column if not exists review_title text;

alter table public.pgc_events
  add column if not exists review_summary text;

alter table public.pgc_events
  add column if not exists review_body text;

alter table public.pgc_events
  add column if not exists review_voice_transcript text;

alter table public.pgc_events
  add column if not exists review_ai_generated_at timestamptz;

alter table public.pgc_events
  add column if not exists review_published_at timestamptz;

alter table public.pgc_event_gallery
  add column if not exists caption text;

alter table public.pgc_event_gallery
  add column if not exists include_in_review boolean default true;

update public.pgc_events
set review_status='draft'
where review_status is null
   or review_status not in ('draft','published');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='pgc_events_review_status_check'
      and conrelid='public.pgc_events'::regclass
  ) then
    alter table public.pgc_events
      add constraint pgc_events_review_status_check
      check (review_status in ('draft','published'));
  end if;
end $$;

insert into public.pgc_schema_meta(version,applied_at)
values ('2.3.0',clock_timestamp())
on conflict (version) do update
set applied_at=excluded.applied_at;

select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
notify pgrst, 'reload schema';

-- FINAL CHECK — expected result: ZERO ROWS.
with required(table_name,column_name) as (
  values
    ('pgc_events','people_attending'),
    ('pgc_events','families_attending'),
    ('pgc_events','volunteers_attending'),
    ('pgc_events','photo_consent_confirmed'),
    ('pgc_events','photo_consent_note'),
    ('pgc_events','photo_consent_confirmed_at'),
    ('pgc_events','photo_consent_confirmed_by'),
    ('pgc_events','review_status'),
    ('pgc_events','review_title'),
    ('pgc_events','review_summary'),
    ('pgc_events','review_body'),
    ('pgc_events','review_voice_transcript'),
    ('pgc_events','review_ai_generated_at'),
    ('pgc_events','review_published_at'),
    ('pgc_event_gallery','caption'),
    ('pgc_event_gallery','include_in_review')
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
