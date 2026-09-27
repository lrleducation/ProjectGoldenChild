# Security model

## Public surface

Static public pages call narrow server APIs. The browser is never given a database service credential. Health information is not exposed through the public events endpoint.

## Admin authentication

Admin accounts are configured server-side. Passwords are stored as scrypt hashes with individual salts. Production accounts use a six-digit TOTP code. Successful sign-in creates a signed HttpOnly, SameSite=Strict session cookie with an eight-hour lifetime.

## Database

Production uses a dedicated Supabase/PostgreSQL project. Sensitive tables have Row Level Security enabled and no public browser policy. Server functions use the service-role credential held in hosting secrets. Local development uses a SQLite database under `.data`, which is excluded from source control and deployment.

## Logging

Application errors log technical messages only. Referral payloads are not written to console output. Admin actions write an audit entry. IP addresses on referrals are one-way hashed before storage.

## Media

Only images explicitly cleared for public website use should be uploaded to the public event bucket. Event attendance does not imply media permission. v1 does not run AI vision over family photographs.

## Fail-closed behaviour

In production, referral/contact/Go Gold write APIs return unavailable if the managed database and admin security settings are incomplete. This prevents a half-configured deployment from silently accepting sensitive information into an inappropriate store.
