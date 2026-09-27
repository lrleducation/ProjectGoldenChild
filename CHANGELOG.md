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
