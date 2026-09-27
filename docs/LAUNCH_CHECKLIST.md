# Project Golden Child v1 launch checklist

Do not open Harper's Heroes registrations publicly until every item in **Required before registrations open** is complete.

## Required before registrations open

1. Create a dedicated production Supabase project and run `supabase/schema.sql`.
2. Keep the Supabase service-role key server-side only. Never add it to public JavaScript.
3. Generate at least two named administrator records with `npm run admin:user -- ...` and set `ADMIN_USERS_JSON` as an encrypted hosting secret.
4. Set a long, random `SESSION_SECRET` in production.
5. Add each administrator's TOTP secret to their authenticator app and confirm two-factor sign-in works.
6. Complete and sign off the DPIA before processing real children's data.
7. Confirm the lawful basis and Article 9 condition used for each health-data purpose and record this in the data-protection documentation.
8. Finalise the privacy notice, retention schedule, safeguarding policy, event photography/media process and data-breach procedure.
9. Complete the ICO data-protection fee assessment and register/pay if required.
10. Configure the production notification email and sender domain. Test referral receipts without placing health information in the notification email.
11. Configure a production backup/recovery process and test a restore.
12. Create the `event-public` storage bucket. Only approved public photographs belong in this bucket.
13. Add Cloudflare Turnstile or an equivalent abuse-control before a high-volume public launch and set `REQUIRE_TURNSTILE=true` once the front-end widget is configured.
14. Review all administrator accounts and remove default/local credentials from the production environment.
15. Run an accessibility and mobile-browser check on the final domain.
16. Test: parent registration, third-party referral, admin review, Hero promotion, recognition action planning/completion, Hero status changes, event draft/publish/complete/archive, public event feed, image upload, Go Gold registration, contact form, sign-out and expired session.

## Required before accepting event bookings

1. Safeguarding lead and escalation route agreed.
2. Event risk assessment template agreed.
3. Parental consent and emergency-contact process agreed.
4. First-aid and venue responsibilities confirmed.
5. Photography/media permissions collected separately from attendance.
6. Event-specific health/allergy/accessibility data retained only as long as needed.

## Required before using AI with family photographs

The current v1 deliberately does **not** send family photographs to an AI model. Before enabling image analysis, complete a specific DPIA review, confirm processor terms/data location, document the purpose and lawful basis, update family information/consent where required, and ensure no image is transferred merely because it was uploaded to an event gallery.
