-- =====================================================================
-- PROJECT GOLDEN CHILD — v2.3.1 STORAGE FIX
--
-- Safe to run repeatedly.
-- This repairs/configures the public event image bucket used by the
-- direct-to-Supabase uploader. It does not delete existing images.
-- =====================================================================

-- Make sure the event-public bucket exists and accepts the image formats
-- used by Project Golden Child.
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
  15728640,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  name=excluded.name,
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- The website uses a server-generated signed upload URL.
-- No public INSERT policy is required for storage.objects.

insert into public.pgc_schema_meta(version,applied_at)
values ('2.3.1',clock_timestamp())
on conflict (version) do update
set applied_at=excluded.applied_at;

notify pgrst, 'reload schema';

-- FINAL CHECK
-- Expected: one row showing event-public, public=true, 15728640.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id='event-public';
