# v2.5.1 dashboard repair and referral confirmation

For an existing v2.5.0 deployment, this is a code-only update. No Supabase migration is required. Deploy the repository and follow `UPDATE_STEPS_v2.5.1.txt`.

# v2.5.0 communications and appointments

This release adapts the strongest operational patterns from the CRACLL app to Project Golden Child without changing PGC into a Next.js application. It adds direct and consent-aware email communication, communication follow-up tracking, a family-linked appointments calendar, automatic email reminders and full delivery addresses for welcome packs/gifts.

For an existing v2.x deployment, run `supabase/UPDATE_v2.5.0.sql` before deploying and then follow `UPDATE_STEPS_v2.5.0.txt`. New installations can use `supabase/schema.sql`.

The new email features require server-side `RESEND_API_KEY` and `FROM_EMAIL`. Appointment reminder staging also requires `CRON_SECRET`. None of these values are exposed to the browser.

# v2.4.0 Storage transport

Event posters and photographs now use a raw Supabase Storage transport that understands
new `sb_secret_*` API keys correctly. The event-image path no longer depends on
`@supabase/supabase-js`, and no additional database migration is required beyond schema v2.3.2.

# v2.3.0 event review workflow

The Events system now supports poster promotion before an event and a separate approved review afterwards, including event photographs, outcome figures, voice-note transcription and optional AI-assisted drafting.

AI requires a server-side `OPENAI_API_KEY` in Vercel. The AI does not automatically receive Harper's Heroes or referral data, and photographs are not supplied to AI unless an administrator explicitly opts in for that event.


## v2.1.0 upgrade

If v2.0.0 is already live, run `supabase/UPDATE_v2.1.0.sql` in Supabase before deploying the code.

After deployment, Admin → System Health should show:

`Database ready — schema 2.1.0. Read and write checks passed.`

The new Communications section is private admin functionality. Delete controls permanently remove the selected active database entry and are audit logged before deletion.

# Project Golden Child v2.1.0

This is the final canonical rebuild of the Project Golden Child website/database integration.

## Database contract

v2.0.0 deliberately uses versioned `pgc_*` Supabase tables and no longer depends on the earlier legacy tables. This removes schema drift caused by incremental early-development migrations.

Run `supabase/FINAL_SUPABASE_SETUP_v2.sql` before deploying v2.0.0.

The admin System Health check now verifies:
- every required application column,
- the canonical schema version (`2.0.0`),
- and a real server-side write/read/delete smoke test.

Public submissions use stable submission IDs stored in the browser session and idempotent database inserts, so retrying a request cannot create a second copy.

# Project Golden Child v1.0.3 — full repository

This is the complete GitHub/Vercel package, not an overlay or hotfix. It combines the approved Project Golden Child gold cape/PGC branding with the public website, working forms, private administration area, local development server, production Supabase schema and deployment documentation.

## Public routes

- `/` Home
- `/our-story`
- `/harpers-heroes`
- `/events`
- `/go-gold`
- `/refer`
- `/privacy`
- `/contact`

## Administrator

Go to `/admin`.

Local development only:
- Email: `admin@local.test`
- Password: `GoldenChildLocal!2026`
- Authenticator code: leave blank

Production uses named administrators from `ADMIN_USERS_JSON` plus an authenticator code. Generate an admin object with:

```bash
npm run admin:user -- adam@example.com "a-strong-unique-password" "Adam" director
```

## Where submissions appear

- Register/refer a child → **Admin > Referrals**
- A consented parent/carer registration can be promoted → **Admin > Harper's Heroes**
- Go Gold form → **Admin > Go Gold 2027**
- Contact form → **Admin > Messages**
- Public events are managed → **Admin > Events**

## Local development

Node 22+:

```bash
npm run dev
```

Open `http://localhost:3000`.

Local data is saved to `.data/project-golden-child.json`. Use dummy data only.

## Production

See `docs/DEPLOYMENT.md` and `docs/LAUNCH_CHECKLIST.md` before accepting real family information.


## Supabase v1.0.4 note

If the v1.0.3 schema failed with `event_gallery_event_id_fkey` because `events.id` is `text`,
run `supabase/fix-v1.0.3-existing-database.sql` in the Supabase SQL Editor. Do not drop the
existing `events` table merely to change its ID type. For a new Supabase project, run the
updated `supabase/schema.sql`.


## v1.0.5 – Supabase new API key support

Supabase now recommends `sb_secret_...` keys instead of legacy `service_role` JWT keys.

For Vercel, use:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` = the secret key shown under **Settings → API Keys → Secret keys**
- `ADMIN_USERS_JSON`
- `SESSION_SECRET`
- `PUBLIC_BASE_URL`
- `PGC_LOCAL_DEV=0`

`SUPABASE_SERVICE_ROLE_KEY` remains supported as a legacy fallback, but is no longer preferred.

Do not use the publishable key for the private server-side database connection in this project.


## v1.0.9 submission repair

If referrals, contact forms or Go Gold submissions return a secure-save error, run `supabase/repair-v1.0.9-submission-pipeline.sql` in the Supabase SQL Editor, then redeploy. The migration is designed to be safe to run repeatedly and does not delete existing records.

The admin dashboard now includes a **System health** check. A healthy production setup reports all required tables as OK.


## v1.0.10 submission repair

If a public form reports “The secure registration service is being updated”, run:

`supabase/repair-v1.0.10-submission-schema-cache.sql`

The final query must return zero rows. Then redeploy v1.0.10 and use Admin → System Health → Check now.

A green v1.0.10 health result validates all fields used by the application, rather than only confirming that each table has an `id` column.

Database submissions appear in the admin area immediately after a successful save. Optional email alerts require:
`RESEND_API_KEY`, `FROM_EMAIL`, and `NOTIFICATION_EMAIL`.


## v1.0.11 public submission rate limiting

Public referral, contact and Go Gold forms now count only fully validated, genuinely new submissions against the anti-abuse limit. Invalid form corrections and duplicate network retries do not consume the limit.

A new deployment also clears any old in-memory rate-limit bucket from earlier versions.


## v1.0.12 admin schema repair

Run `supabase/repair-v1.0.12-admin-schema.sql` if System Health reports missing fields in heroes, hero_actions or events. The final query should return zero rows.

