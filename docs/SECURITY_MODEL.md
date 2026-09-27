# Security model

Public pages never receive the Supabase service-role key and never query private tables directly. Public form submissions go to same-origin serverless functions. Admin data is available only after a signed, HttpOnly, SameSite=Strict session cookie is issued following a named-user password and authenticator-code login.

Production requires Supabase and `SESSION_SECRET`; it fails closed if those settings are missing. Supabase tables have RLS enabled without public policies. Health information is kept in private referral/Hero records and is not automatically published to the events page or any public directory.

The event image bucket is intentionally public because it is only for photographs already approved for website publication. Do not use it for private family images, referral documents or evidence.

The local development login and JSON database are for testing with dummy data only.
