# Project Golden Child v1 deployment

This build is intended to be deployed as one application with the public website and the permission-protected administration area under the same domain.

## 1. Create the production database

Create a dedicated Supabase project, open the SQL editor and run `supabase/schema.sql` in full. Create a public Storage bucket named `event-public`; use it only for photographs already approved for public website use.

## 2. Create named administrator accounts

For each administrator run:

```bash
npm run admin:user -- adam@example.com "A unique strong password" "Adam" director
```

The script prints the password-hash record and a TOTP secret. Put all administrator records into one JSON array for `ADMIN_USERS_JSON`. Add each TOTP secret to the correct person's authenticator application. Never reuse the local-development password in production.

## 3. Set hosting secrets

Set the variables shown in `.env.example` in the hosting platform. At minimum the production site requires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `ADMIN_USERS_JSON`
- `PUBLIC_BASE_URL`

Configure email before launch using `RESEND_API_KEY`, `FROM_EMAIL` and `NOTIFICATION_EMAIL`. `OPENAI_API_KEY` is optional; without it the event-story workflow uses its non-AI fallback. If the OpenAI key is used, the default model can be overridden with `OPENAI_MODEL`.

## 4. Deploy to Vercel

Import the project into Vercel or deploy the repository. The root of this folder is the project root. `vercel.json` defines the public routes, API routing and security headers.

Deploy a preview first. Do not open Harper's Heroes registrations to real families until the production database, administrator MFA, policies, DPIA and final privacy information have been checked.

## 5. Connect the domain

When the domain has been registered, add it in Vercel Project Settings > Domains. Follow the DNS records Vercel gives for the registrar. Then set `PUBLIC_BASE_URL=https://your-domain` and redeploy so sitemap and robots output use the final site address.

## 6. Launch verification

Use `docs/LAUNCH_CHECKLIST.md`. Test the full parent registration and third-party referral routes, admin sign-in and MFA, Hero promotion and recognition actions, event publishing/archiving, public event display, approved image uploads, Go Gold registrations, contact messages, logout/session expiry and mobile/accessibility behaviour on the final domain.
