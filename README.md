# Project Golden Child redesign starter

This is a Next.js App Router starter matching the approved gold/cream Project Golden Child direction.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

Admin visual shell: http://localhost:3000/admin

## Use this with your existing site

The quickest implementation path is:

1. Copy `public/project-golden-child-logo.png` into your existing site's `public` folder.
2. Replace your homepage with `app/page.tsx`.
3. Copy `components/SiteHeader.tsx`.
4. Merge the styles from `app/globals.css` into your existing global stylesheet.
5. If your site already has working forms/database/admin routes, keep that backend and wire its data into the visual admin shell. Do not replace a working backend with the placeholder admin content in this starter.

## Logo

All front-end logo instances read from:

`/public/project-golden-child-logo.png`

Replacing that one file updates the logo throughout this starter.

## Important

The admin upload control in this starter is deliberately disabled. A visual upload button is not a real storage system. Wire it to your existing storage/database/API before enabling it.

The public story cards intentionally contain no invented children, medical histories or photographs. Replace these with family-approved material only.
