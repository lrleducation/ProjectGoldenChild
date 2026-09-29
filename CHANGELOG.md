# v2.1.1 — Final Project Golden Child logo

- Replaced the website master logo with the approved transparent cape logo supplied by Adam.
- The approved artwork uses the floating gold cape as the PGC hero symbol, with integrated PGC lettering, childhood cancer awareness ribbon and the strapline Awareness | Recognition | Community.
- Updated the compact navigation/admin mark from the same artwork.
- Updated the favicon from the same artwork.
- Added v2.1.1 asset cache-busting so Vercel/browser caches do not continue showing the previous logo.
- No database or Supabase changes are required for this update.

# v2.1.0 — Brand, deletion controls and communications

- Replaced the previous star logo with the approved cape/PGC logo using the childhood cancer awareness ribbon.
- Updated the brand tags to Awareness · Recognition · Community.
- Removed the overlapping handwritten hero strapline that caused the homepage logo formatting error.
- Added a responsive logo lock-up so the complete head, cape, wordmark and tags remain visible.
- Added permanent delete controls for referrals, Harper's Heroes records, recognition actions, events, event gallery entries, Go Gold registrations, website messages and communication records.
- Delete actions require two confirmations for primary records.
- Added a private Communications section for logging email, phone, SMS/WhatsApp, letters, in-person contact, video calls and other contact.
- Communications can be linked to a Harper's Hero or referral and include date/time, direction, contact details, subject, notes, outcome and follow-up date.
- Added quick “Log communication” controls directly from referrals and Harper's Heroes.
- Added a communications dashboard count.
- Added `pgc_communications` to System Health.
- Supabase schema version is now 2.1.0.

# v2.0.0 — Final canonical database rebuild

- Replaced dependency on legacy Supabase tables with clean canonical `pgc_*` tables.
- Added a single final Supabase setup SQL that creates the complete schema, indexes, RLS, grants, Storage bucket and schema metadata.
- Old tables are retained untouched as a safety archive.
- Added best-effort legacy data copy without deleting old records.
- Added real Data API write/read/delete System Health smoke testing.
- System Health now requires schema version `2.0.0`.
- Reworked all database access through a logical-to-physical table map.
- Made all inserts idempotent at database-request level using fixed IDs and `resolution=ignore-duplicates`.
- Persisted public submission IDs in sessionStorage across manual retries.
- Public submissions are verified by an immediate read-back before success is shown.
- Increased legitimate public form tolerance while retaining honeypot, validation and rate-limit protection.
- Fixed nullable timestamp handling in referral administration.
- Retained support for Supabase `sb_secret_*` server-side keys.
- Retained secure admin login, TOTP, audit logging and optional email alerts.

# v1.0.12 – Remaining admin schema repair

- Added a safe Supabase repair for all fields required by `heroes`, `hero_actions`, and `events`.
- Repairs the exact System Health failures for `heroes.journey_notes`, `hero_actions.value_gbp`, and `events.public_image_url`, plus any other required columns in those tables.
- Re-applies secure server-side grants, RLS, indexes, and relationship constraints where missing.
- Forces PostgREST schema refresh after repair.
- Final SQL verification returns zero rows when the database matches the application.

# v1.0.11 – Public submission rate-limit repair

- Fixed public forms reaching the abuse limit during legitimate corrections, retries and testing.
- Referral, Contact and Go Gold requests are now counted only after validation and duplicate detection.
- Increased the public form threshold to 30 validated new submissions per 15 minutes per connection.
- Parent/carer registrations and third-party referrals have separate referral buckets.
- Browser retry logic no longer retries HTTP 429 immediately.
- Duplicate submission IDs are checked before rate limiting, so a connection retry cannot block an already-saved form.
- Added Retry-After responses for genuine high-volume abuse.
- Admin login rate limiting remains unchanged.

# v1.0.10 – Submission schema/cache repair and stronger health checks

- System Health now checks every database column required by referrals, contact forms, Go Gold, events and Harper's Heroes, not just table reachability.
- Fixed a misleading green health check where `select id` worked but public inserts could still fail because PostgREST had stale/missing column metadata.
- Added a safe SQL repair that creates any missing submission columns and forces PostgREST's schema cache/notification queue to refresh.
- The SQL finishes with a missing-column report; successful repair returns zero rows.
- System Health now reports whether optional instant email alerts are configured.
- Public submission retry and duplicate-protection from v1.0.9 remain enabled.

# v1.0.9 – Submission reliability and Supabase Data API repair

- Fixed the main production submission failure for new Supabase projects by explicitly granting the server-side `service_role` Data API permissions.
- Added an idempotent database repair script that adds missing public-form columns without deleting existing records.
- Added database request timeout/retry handling for transient Supabase/API failures.
- Added idempotent client submission IDs so an automatic retry does not create duplicate referrals, messages or Go Gold registrations.
- Added a secure admin-only System Health check for all required database tables.
- Public errors now include a short support reference that can be matched to Vercel logs without exposing database details.
- Audit logging and notification email failures no longer block a successfully saved public submission.

# v1.0.8 – Admin JSON compatibility fix

- Fixed a Windows PowerShell setup issue where a single administrator could be written to `ADMIN_USERS_JSON` as a JSON object instead of a one-item JSON array.
- Production authentication now accepts either format safely.
- Fixed the Windows setup helper so new setups always generate the documented array format.
- No password, TOTP or session-security checks have been weakened.

# v1.0.7 – Admin login error-message fix

- Fixed the admin sign-in page incorrectly showing “Your session has ended” when the login endpoint rejected the email, password or authenticator code.
- Invalid sign-in details now show the correct generic message: “Email, password or authenticator code is incorrect.”
- No authentication security has been weakened; the server still does not reveal which individual credential failed.

# v1.0.6 – Easy Windows admin setup

- Added `SETUP_ADMIN_WINDOWS.bat` for a guided administrator setup.
- Password entry is hidden while typed.
- Automatically generates `ADMIN_USERS_JSON`, `SESSION_SECRET`, TOTP authenticator secret and URI.
- Writes the values to a temporary local `PGC-VERCEL-SETUP.txt`.
- Added the generated setup file to `.gitignore` so it is not committed accidentally.

# v1.0.5 – New Supabase API key support

- Added first-class support for Supabase `sb_secret_...` keys.
- Added `SUPABASE_SECRET_KEY` as the preferred server-side environment variable.
- Kept `SUPABASE_SERVICE_ROLE_KEY` as a legacy fallback.
- Removed invalid Bearer-token use for opaque `sb_secret_...` keys.
- Updated Storage uploads to support new Supabase secret keys correctly.

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
