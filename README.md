# Julieta & Graham — wedding uploads

Guests scan a QR code, pick photos/videos, and they upload straight into a **private** Supabase Storage bucket (`wedding_uploads`). Page is Spanish first, English underneath.

## How it works
1. QR opens `https://YOUR-DOMAIN/?c=julietaygraham`. Without the right code the page shows "Enlace no válido".
2. For each file the browser asks `/api/upload-url` (checks the code, file type and size) and gets a one-time signed upload URL.
3. The browser uploads directly to Supabase (not through Vercel, so no 4.5 MB body limit), with progress and automatic retries, 3 files at a time.
4. `/api/complete` confirms the object exists and records it in the `wedding_uploads` table.
5. `/admin` (password) shows the gallery with signed URLs. `npm run download` pulls everything to your disk.

No storage policies are needed: the bucket is private and only the server (service role key) creates upload URLs.

## Setup
1. **Bucket** `wedding_uploads` → set **Private**, file size limit **500 MB**, allowed MIME types `image/*, video/*`. Also raise the project-wide limit in Storage settings (default is 50 MB).
2. Run `supabase/migrations/20261119000000_wedding_uploads.sql` in the SQL editor (or `supabase db push`).
3. `cp .env.example .env.local` and fill it in. The service role key is secret: keep it server-side only.
4. `npm install && npm run dev`, then open `http://localhost:3000/?c=julietaygraham`.
5. Deploy to Vercel and add the same 5 env vars there.
6. QR: `npm run qr -- https://YOUR-DOMAIN` writes `qr.png` and `qr.svg`.

## Test before the wedding (on a phone, on cellular)
- Upload a 20+ MB video, a HEIC photo, and ~15 photos at once.
- Turn airplane mode on mid-upload, then off: it should retry or show "Reintentar".
- Open the QR link without `?c=`: should show the invalid-link page.
- Check the files and rows appear in `/admin`.

## Notes and limits
- Per-file caps: 100 MB photo, 500 MB video (enforced in the API; the bucket limit is the backstop).
- Uploads are single-request with retries, not resumable. A dropped connection on a big video restarts that file.
- The rate limiter is in-memory per server instance (best effort). The event code is the real gate. Don't post the QR link publicly.
- Pro includes 100 GB storage (shared across the org) and 250 GB egress. Download everything after the wedding, keep a backup elsewhere.
- `npm run download` skips files already downloaded, so you can re-run it.
