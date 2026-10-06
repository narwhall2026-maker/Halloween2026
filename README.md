# Halloween 2026 Photo Wall

A public, no-sign-in Halloween photo wall for an event. Visitors scan a QR code, choose a photo on their phone, and the image appears on the live wall.

## Current architecture

For the first version, the app uses Supabase only:

- Supabase Storage bucket `wall-photos` stores images.
- Supabase Postgres table `wall_photos` stores photo metadata.
- The browser reads approved photos from PostgREST and polls every 4 seconds.
- Images are served from Supabase Storage's public object endpoint.
- No sign-in is required.

Cloudflare R2/D1 files remain in the repository for a future migration, but they are not required for the current build.

## Upload rules

- No account or sign-in is required.
- Maximum file size is 15 MB.
- Accepted types: JPEG, PNG, WebP, HEIC and HEIF.
- Every photo receives a random UUID-based public ID.
- Photos are marked approved on insertion so they appear on the live wall immediately.

## QR code

The home page generates the QR code in the browser and points it to `/?upload=1`, which opens the upload dialog directly.

## Project structure

```text
web/
  index.html
  styles.css
worker/
  index.js
  schema.sql
  wrangler.toml
```

## Deployment

The frontend is static and can be deployed to Vercel, Cloudflare Pages, GitHub Pages, or any static host. The frontend already contains the Supabase project URL and publishable key, which are intended for browser use.

The `worker/` directory is retained for the planned Cloudflare R2/D1 version and is not needed for the Supabase version.
