# Halloween 2026 Photo Wall

A public, no-sign-in Halloween photo wall for an event. Visitors scan a QR code, choose a photo on their phone, and the image appears on the live wall.

## Current architecture

The first working version is Supabase-first:

- Supabase Storage bucket `wall-photos` stores images.
- Supabase Postgres table `wall_photos` stores photo metadata.
- The browser reads approved photos from PostgREST and polls every 4 seconds.
- Images are served from Supabase Storage's public object endpoint.
- A Supabase Edge Function serves the static site at `https://vjugsidfdovuwtxgcvrz.supabase.co/functions/v1/halloween-wall`.
- No sign-in is required.

Cloudflare R2/D1 files remain in the repository for a future migration, but they are not required for the current build.

## Upload rules

- No account or sign-in is required.
- Maximum file size is 15 MB, enforced in the browser and Storage bucket.
- Accepted types: JPEG, PNG, WebP, HEIC and HEIF.
- Every photo receives a random UUID-based public ID.
- Photos are marked approved on insertion so they appear on the live wall immediately.
- The upload form includes a simple honeypot anti-bot check.

## QR code

The home page generates the QR code in the browser and points it to `/?upload=1`, which opens the upload dialog directly.

## Project structure

```text
web/
  index.html
  styles.css
  app.js
supabase/functions/halloween-wall/
  index.ts
worker/
  index.js
  schema.sql
  wrangler.toml
```

## Deployment

The public site is currently served by the Supabase Edge Function above. Its source is stored in `supabase/functions/halloween-wall/index.ts` and proxies the versioned static files from this GitHub repository.

The frontend contains only the Supabase project URL and publishable key. No secret/service key is included in browser code.

The `worker/` directory is retained for the planned Cloudflare R2/D1 version and is not needed for the current Supabase version.
