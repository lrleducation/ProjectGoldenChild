# v1.0.4 – Supabase compatibility fix

- Fixed `event_gallery_event_id_fkey` deployment failure where an existing `events.id` column is `text`.
- Standardised new schema IDs and relationship IDs as text containing UUID-formatted values.
- Added `supabase/fix-v1.0.3-existing-database.sql` for databases where the v1.0.3 schema stopped at `event_gallery`.
- No public or admin workflow changes.

# Changelog

## v1.0.3
- Full repository restored around the v1.0.2 visual redesign.
- Approved PGC superhero-cape logo installed across the site.
- Added all missing public JavaScript files.
- Added working referral, Go Gold, contact and public-events APIs.
- Added secure admin login/session, referrals, Harper's Heroes, recognition actions, event management, Go Gold registrations and messages.
- Added approved-public-image upload flow for events.
- Added local development persistence and production Supabase storage/data layer.
- Added Supabase schema, deployment, security and DPIA starter documentation.
- Updated charity-status wording to reflect registration in progress without claiming registration is complete.
