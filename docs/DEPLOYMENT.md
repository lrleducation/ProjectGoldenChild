# Deployment

1. Create a dedicated Supabase project for Project Golden Child.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. In Supabase Storage create a **public** bucket called `event-public`. Use it only for images already approved for public website use.
4. In Vercel, import the GitHub repository and set the production environment variables from `.env.example`.
5. Generate each administrator with `npm run admin:user -- email "password" "Name" role` and place the generated objects in one JSON array in `ADMIN_USERS_JSON`.
6. Set a long random `SESSION_SECRET`.
7. Deploy to Preview first and test every route and form before promoting to Production.

The production API fails closed if Supabase is not configured. Do not accept real family information against the local JSON development database.


## v2.5.0 email and appointment settings

For platform email and appointment reminders also configure `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFICATION_EMAIL`, optional `REPLY_TO_EMAIL`, optional `APPOINTMENT_ADMIN_EMAIL`, and a long random `CRON_SECRET`. Existing live databases must run `supabase/UPDATE_v2.5.0.sql` before the v2.5.0 code is deployed.
