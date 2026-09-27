# Project Golden Child v1.0.2 — brand redesign hotfix

This package applies the approved Project Golden Child gold superhero-cape identity to the existing v1.0.1 site.

## What this update changes

- Installs the approved Project Golden Child logo.
- Adds a transparent full logo and cape mark.
- Redesigns the public site in the gold/cream visual style.
- Updates the home-page hero to: “Making childhood cancer impossible to ignore.”
- Replaces the missing `cape.svg` reference on Harper’s Heroes with the approved cape mark.
- Rebrands the private admin screen in the same visual identity.
- Adds a clear admin dashboard guide explaining where public form submissions appear.

## Where submissions appear in the existing admin system

Go to `/admin`.

- `Refer a child` submissions → **Referrals**
- Approved/converted child records → **Harper's Heroes**
- Go Gold registrations → **Go Gold 2027**
- General website contact forms → **Messages**
- Events are managed under **Events**

The login credentials and production authentication model remain those described in the original v1.0.1 README.

## Important: this uploaded v1.0.1-hotfix was not a complete repository

The source ZIP supplied for this update contains the HTML pages and `vercel.json`, but it does **not** contain the JavaScript, API functions, database code, package files, documentation or the existing CSS files referred to in its own README.

For that reason this v1.0.2 package is deliberately a **front-end overlay/hotfix**. It does not replace, invent or disable the secure forms/database/admin back end.

Apply this package over the complete Project Golden Child repository so that the existing files such as:

- `/public/site.js`
- `/public/refer.js`
- `/public/contact.js`
- `/public/events.js`
- `/public/go-gold.js`
- `/public/admin/admin.js`
- `/api/...`
- Supabase/database files

remain in place.

## Files added or replaced by this hotfix

- `public/*.html`
- `public/admin/index.html`
- `public/styles.css`
- `public/admin/admin.css`
- `public/assets/project-golden-child-logo.png`
- `public/assets/project-golden-child-mark.png`
- `public/assets/pgc-favicon.png`
- `vercel.json`
- `README.md`

## Deployment

1. Back up the current complete repository.
2. Extract this hotfix over the repository root.
3. Keep all existing JavaScript/API/database files that are not present in this hotfix.
4. Commit and push to GitHub.
5. Allow Vercel to create a preview deployment.
6. Test every public form and `/admin` before promoting the deployment to production.

Do not accept real family/health information until the production database, administrator authentication and privacy controls from the full repository are configured.
