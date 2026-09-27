# Deployment

1. Create a dedicated Supabase project for Project Golden Child.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. In Supabase Storage create a **public** bucket called `event-public`. Use it only for images already approved for public website use.
4. In Vercel, import the GitHub repository and set the production environment variables from `.env.example`.
5. Generate each administrator with `npm run admin:user -- email "password" "Name" role` and place the generated objects in one JSON array in `ADMIN_USERS_JSON`.
6. Set a long random `SESSION_SECRET`.
7. Deploy to Preview first and test every route and form before promoting to Production.

The production API fails closed if Supabase is not configured. Do not accept real family information against the local JSON development database.
