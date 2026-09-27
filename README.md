# Project Golden Child v1

Production-oriented first version of the Project Golden Child website and private administration system.

## What is included

Public pages for Home, Our Story, Harper's Heroes, Events, Go Gold, secure registration/referral with separately recorded health-data consent, privacy/safeguarding and contact. The private `/admin` area includes dashboard metrics, referrals, the Harper's Heroes register with recognition/contact actions, event creation/publishing/archiving, approved image uploads and galleries, dictated event notes, AI-assisted event-story drafting, Go Gold registrations and website messages.

The childhood cancer gold ribbon is used throughout the public identity. The Harper's Heroes page uses the gold HH cape asset in `public/assets/cape.svg`.

## Local development

Requires Node 22 or newer. There are no runtime npm dependencies.

```bash
npm run dev
```

Open `http://localhost:3000`.

For local development only, the admin login is:

- Email: `admin@local.test`
- Password: `GoldenChildLocal!2026`
- TOTP: leave blank

Local data is stored in `.data/project-golden-child.db`. Never use the local development database for real family information.

## Production database

1. Create a dedicated Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create a public storage bucket named `event-public`. This bucket is for photographs that have already been cleared for public use only.
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-side deployment secrets.

Do not expose the service-role key in public JavaScript or a browser environment variable.

## Production admin accounts

Generate a password hash and TOTP secret:

```bash
npm run admin:user -- adam@example.com "A very strong unique password" "Adam" director
```

Run the command once for each named administrator. Put the generated objects into a JSON array and store it as the `ADMIN_USERS_JSON` hosting secret. Each administrator adds their generated TOTP secret to an authenticator app.

Also set a long random `SESSION_SECRET`.

## Email

The site can use Resend through its HTTP API without an SDK. Set:

- `RESEND_API_KEY`
- `FROM_EMAIL`
- `NOTIFICATION_EMAIL`

Referral notification emails contain a reference only, not the child's diagnosis or medical details.

## AI event drafting

If `OPENAI_API_KEY` is configured, the event editor can generate a first draft from typed or dictated notes. If it is not configured, a structured non-AI draft is still produced so the workflow remains usable. AI text is never published automatically.

v1 intentionally does not send event photographs to an AI model. The gallery is functional, but image-analysis automation should only be enabled after a specific data-protection assessment.

## Vercel deployment

This project is structured for Vercel: static pages live under `public/`, server functions under `api/`, and `vercel.json` provides clean routes and security headers.

Set all production environment variables from `.env.example`, deploy a preview, run the launch tests, then attach the chosen domain in Vercel Project Settings > Domains. Set `PUBLIC_BASE_URL` to the final `https://` domain before production launch so the sitemap uses the correct address.

## Before real family data is accepted

Read `docs/DEPLOYMENT.md`, `docs/LAUNCH_CHECKLIST.md`, `docs/DPIA_STARTER.md` and `docs/SECURITY_MODEL.md`. The application is designed to fail closed in production if the secure database/authentication configuration is missing.
