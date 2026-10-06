# Halloween 2026 Photo Wall

A public, no-sign-in Halloween photo wall for an event. Visitors scan a QR code, choose a photo on their phone, and the image appears on the live wall.

## Architecture

- Cloudflare Worker serves the web app and API.
- Cloudflare R2 stores the original image objects.
- Cloudflare D1 stores photo metadata.
- The browser polls the photo API every 4 seconds, so no WebSocket service is required.
- Images are delivered through the Worker with long-lived cache headers.

## Project structure

```text
web/
  index.html
  styles.css
  app.js
worker/
  index.js
  schema.sql
  wrangler.toml
```

## Cloudflare setup

1. Install Wrangler and authenticate with Cloudflare.
2. Create an R2 bucket named `halloween-wall-photos`.
3. Create a D1 database named `halloween-wall`.
4. Copy the D1 database ID into `worker/wrangler.toml` in place of `REPLACE_WITH_D1_DATABASE_ID`.
5. Apply the schema:

```bash
cd worker
npx wrangler d1 execute halloween-wall --remote --file=schema.sql
```

6. Deploy from the `worker` directory:

```bash
npx wrangler deploy
```

The `[assets]` configuration publishes the contents of `../web` alongside the Worker.

## Local development

From `worker/`:

```bash
npx wrangler dev
```

For local D1/R2 development, use Wrangler's local bindings. The production D1/R2 resources are used only when deploying with the appropriate remote options.

## Upload rules

- No account or sign-in is required.
- Maximum file size is 15 MB.
- Accepted types: JPEG, PNG, WebP, HEIC and HEIF.
- The server validates the file type and size again even if the browser has already checked them.
- Every photo receives a random UUID-based public ID and server-generated R2 object key.
- IP addresses are never stored directly; the Worker stores a SHA-256 hash only for basic upload throttling.
- Photos are marked approved on insertion so they appear on the live wall immediately.

## QR code

The home page generates the QR code in the browser and points it to `/?upload=1`, which opens the upload dialog directly. This means there is no separate `/upload` route to maintain.

If the deployed site is `https://example.workers.dev`, the QR code automatically points to `https://example.workers.dev/?upload=1`.

## Event deployment checklist

- Create the R2 bucket.
- Create the D1 database.
- Put the D1 ID in `worker/wrangler.toml`.
- Run `schema.sql` against the remote database.
- Deploy with Wrangler.
- Open the deployed site and test the QR code from a phone.
- Upload a photo under 15 MB.
- Confirm it appears on the wall.
- Leave the wall page open on the event TV/projector.

## Notes

The application intentionally keeps the public surface small. There is no client-side access to R2 credentials and no authentication flow for guests.

For a larger public event, Cloudflare Turnstile or a more formal rate-limit/WAF rule can be added later without changing the storage model.
