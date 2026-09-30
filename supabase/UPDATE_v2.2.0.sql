-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.2.0
-- Poster-led Events update
-- Safe to run repeatedly. Existing data is retained.
-- =====================================================================

-- Add the explicit public website section and accessible poster description.
alter table public.pgc_events
  add column if not exists display_section text default 'future';

alter table public.pgc_events
  add column if not exists poster_alt text;

-- Bring existing records into the new Upcoming / Past model.
update public.pgc_events
set display_section = case
  when start_at is not null and start_at < now() then 'past'
  else 'future'
end
where display_section is null
   or display_section not in ('future','past');

-- Keep the value constrained to the two supported public sections.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='pgc_events_display_section_check'
      and conrelid='public.pgc_events'::regclass
  ) then
    alter table public.pgc_events
      add constraint pgc_events_display_section_check
      check (display_section in ('future','past'));
  end if;
end $$;

-- Allow high-resolution externally designed posters up to 8 MB.
update storage.buckets
set public=true,
    file_size_limit=8388608,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='event-public';

insert into public.pgc_schema_meta(version,applied_at)
values ('2.2.0',clock_timestamp())
on conflict (version) do update
set applied_at=excluded.applied_at;

-- Refresh PostgREST immediately.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
select pg_sleep(1);
notify pgrst, 'reload schema';

-- FINAL CHECK — expected result: ZERO ROWS.
with required(table_name,column_name) as (
  values
    ('pgc_events','display_section'),
    ('pgc_events','poster_alt'),
    ('pgc_events','public_image_url'),
    ('pgc_events','status'),
    ('pgc_events','title')
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
