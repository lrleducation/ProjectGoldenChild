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
