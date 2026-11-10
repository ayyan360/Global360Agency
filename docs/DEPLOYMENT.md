# Deploying Global360

Global360 is one Node.js API, one static React build, one PostgreSQL database and (for uploads/certificates) one private object-storage bucket. No specific hosting provider is assumed.

## 1. Choose a topology

**A. Single service (simplest).** Express serves the API and the built SPA from one origin.
`npm run build` → set `SERVE_CLIENT=true` → `npm start`. Cookies are first-party; `COOKIE_SAMESITE=lax`.

**B. Separate static hosting + API on the same site.** Serve `client/dist` from a CDN/static host and route `/api/*` to the API through the same domain (reverse proxy rule). Keep `VITE_API_BASE_URL=/api`.

**C. Different sites (e.g. `app.example.com` and `api.example-api.com`).** Set `VITE_API_BASE_URL=https://api…/api` at build time, `CLIENT_URL=https://app.example.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`. Prefer A or B: third-party cookies are increasingly blocked by browsers.

## 2. Production environment variables (`server`)

```
NODE_ENV=production
PORT=5000
CLIENT_URL=https://app.example.com            # exact origin(s), comma-separated
PUBLIC_APP_URL=https://app.example.com        # used in certificate verification links/QR codes
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/global360
DATABASE_SSL=true                              # if your provider requires TLS
JWT_SECRET=<48+ random bytes, hex>             # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_EXPIRES_IN_HOURS=24
COOKIE_SECURE=true
COOKIE_SAMESITE=lax                            # 'none' only for topology C
TRUST_PROXY=1                                  # number of proxies in front (needed for correct client IPs and rate limits)
STORAGE_DRIVER=s3
S3_BUCKET=… S3_REGION=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=…
S3_ENDPOINT=…                                  # for R2/B2/MinIO/Spaces; omit for AWS
S3_FORCE_PATH_STYLE=false                      # true for MinIO
SIGNED_URL_TTL_SECONDS=300
ENABLE_JOBS=true                               # or false + external scheduler (see §6)
SERVE_CLIENT=true                              # topology A only
CERTIFICATE_ISSUER_NAME=Global360 Internship Program
CERTIFICATE_SIGNATORY_NAME=                    # only with the person's agreement
CERTIFICATE_SIGNATORY_TITLE=
LOG_LEVEL=info
GROQ_API_KEY=<Groq API key>                    # optional; enables the signed-in learning assistant
GROQ_MODEL=openai/gpt-oss-120b                  # optional; defaults to this model
```

Store secrets in your platform's secret manager. Never commit them, and never put secrets in `VITE_*` variables (they are compiled into public JavaScript). The learning assistant sends chat messages from signed-in users to Groq to generate replies; omit `GROQ_API_KEY` to leave the assistant disabled.

## 3. Build and start

```bash
npm ci
npm run build                 # client/dist
npm run db:migrate            # run as a release step, before starting new code
npm start                     # node server/src/server.js
```

The server logs a warning on startup if migrations are pending. Health check: `GET /api/health` (200 when the database is reachable, 503 otherwise).

## 4. Database

- PostgreSQL **15+** (the schema uses `NULLS NOT DISTINCT`).
- Run migrations explicitly (`npm run db:migrate`) in a release step; they are never run automatically on boot. Review `npm run db:migrate:status` first. `db:migrate:undo` drops tables — **do not run it against production data** without a backup.
- Do **not** run `npm run db:seed` in production (it refuses unless `--allow-production`; demo accounts are always refused).
- **Backups:** enable automated daily snapshots with point-in-time recovery if available; additionally schedule `pg_dump --format=custom` to separate storage, keep ≥ 30 days, and test restores regularly. Back up the object-storage bucket (versioning) alongside the database — attachments and certificate PDFs are referenced by key.

## 5. File storage

- Create a **private** bucket (block all public access). The API writes objects without public ACLs and serves downloads with short-lived signed URLs.
- Grant the API credentials only `PutObject`, `GetObject`, `DeleteObject`, `HeadObject` on that bucket.
- Upload limits are per program (default: PDF/PNG/JPG/WEBP/ZIP, 10 MB each, 5 files), capped by a hard 25 MB/10-file server limit. Files are validated by content signature, never executed, and stored under random keys.
- If storage is not configured (`STORAGE_DRIVER=none`), uploads return a clear 503 message and certificate PDFs are generated on demand without being stored.
- Local storage (`STORAGE_DRIVER=local`) is for development or single-server deployments with a persistent, backed-up disk.
- Certificate payment receipts use the same private storage driver as other sensitive uploads; do not move them into a publicly served uploads directory.

### Certificate payments

- Set the course certificate fee on each course and the internship certificate fee on each program. Fees are in PKR; set `0` for a free certificate.
- Configure the bank name, account holder, and bank account/IBAN under **Admin → Settings**. Verify the destination account before sharing payment instructions; do not use a card number as a bank transfer account.
- Admins review uploaded receipt images under **Admin → Certificates → Certificate payment receipts**. The server blocks downloads and public verification of paid certificates until an admin approves payment.
- Receipt uploads accept JPG, PNG, or WEBP images up to 5 MB. Configure private persistent storage (local or S3-compatible) before accepting receipts.

## 6. Background jobs

Every 15 minutes the job runner (guarded by a PostgreSQL advisory lock, so only one instance runs it) will:
1. Move approved enrollments to *in progress* when the program starts.
2. Send "new task available" notifications (deduplicated).
3. Send deadline reminders (deduplicated).
4. Evaluate enrollments of ended programs and issue certificates idempotently.
5. Purge long-expired sessions.

With multiple API instances you can keep `ENABLE_JOBS=true` on all of them (the lock prevents overlap) or set it to `false` and call `npm run jobs:run -w server` from a platform cron.

## 7. Email (optional)

Email delivery is not configured (`EMAIL_PROVIDER=none`). All notifications are stored in-app; the platform never claims an email was sent. To add email, implement a provider in `server/src/services/` and call it from `notificationService.notify` using environment-based credentials.

## 8. Admin bootstrap

```bash
ADMIN_NAME="…" ADMIN_EMAIL="…" ADMIN_PASSWORD="…" npm run db:create-admin
```

Run once from a secure shell, then remove the variables. Create further staff accounts from the admin UI.

## 9. Security checklist

- [ ] HTTPS everywhere; `COOKIE_SECURE=true`
- [ ] `CLIENT_URL` lists only your real origins
- [ ] `TRUST_PROXY` matches your proxy chain
- [ ] Strong unique `JWT_SECRET`; rotate by deploying a new value (all sessions end)
- [ ] Private bucket, least-privilege credentials
- [ ] Database not publicly reachable; TLS enabled
- [ ] Error logs shipped to your log platform (Pino JSON on stdout; cookies/auth headers are redacted)
- [ ] Review the Privacy Policy and Terms templates with legal counsel
- [ ] Configure contact details and social links under Admin → Settings

## 10. Updating

1. Back up the database. 2. Deploy new code. 3. `npm run db:migrate`. 4. Restart. 5. Check `/api/health` and the admin dashboard.
