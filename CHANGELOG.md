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
