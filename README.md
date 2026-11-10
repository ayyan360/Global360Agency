# Global360

**Full-stack learning platform and free internship management system.**

Global360 combines a public course website and learning dashboard with a complete three-month internship workflow: applications, Monday–Friday task scheduling, submissions with secure uploads, reviewer assessments, server-side scoring, automatic PDF certificates and public certificate verification.

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, React Router 7, React Hook Form + Zod, Axios, Lucide icons (JavaScript, no TypeScript)
- **Backend:** Node.js 20+, Express 5, PostgreSQL, Sequelize 6 (migrations via Umzug), Zod validation, JWT in HTTP-only cookies, Helmet, rate limiting, Pino logging
- **Tests:** Node test runner + Supertest (102 backend tests), Vitest + React Testing Library (20 frontend tests), Playwright smoke script (8 end-to-end UI workflows)

> See [`docs/CHECKLIST.md`](docs/CHECKLIST.md) for the feature checklist and the honest test report, [`docs/API.md`](docs/API.md) for the REST API, and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for production deployment.

---

## 1. Repository structure

```
global360/
├── package.json            # npm workspaces + root scripts
├── .env.example            # pointer to the per-app env files
├── client/                 # React + Vite SPA
│   ├── public/             # favicon
│   └── src/
│       ├── components/     # common (ui, Modal, DataTable, Logo, Illustrations), layout, forms, courses, internship, dashboard, admin
│       ├── pages/          # public, auth, student, internship, admin, errors
│       ├── layouts/        # PublicLayout, DashboardLayout (role-aware sidebar)
│       ├── routes/         # route guards
│       ├── context/        # Auth, Toast, Settings
│       ├── hooks/          # useApi, useQueryState, useDebounce…
│       ├── services/api.js # central Axios client (CSRF, error normalisation)
│       ├── constants/      # status labels, navigation + permissions
│       ├── styles/index.css# Tailwind v4 @theme design tokens
│       └── test/           # Vitest suites
├── server/                 # Express API
│   ├── src/
│   │   ├── config/         # env (Zod-validated), database, migrator
│   │   ├── models/         # Sequelize models + associations
│   │   ├── migrations/     # schema (ES-module migrations run by Umzug)
│   │   ├── seeders/        # idempotent sample content + optional demo data
│   │   ├── routes/         # route → middleware → controller wiring
│   │   ├── controllers/    # thin HTTP handlers
│   │   ├── services/       # business logic (internship/, storage/)
│   │   ├── middleware/     # auth, csrf, validate, rate limits, uploads, errors
│   │   ├── validators/     # Zod request schemas
│   │   ├── jobs/           # scheduled jobs (task release, reminders, completion)
│   │   ├── scripts/        # migrate, seed, create-admin, run-jobs
│   │   ├── utils/          # errors, logger, pagination, permissions, slug
│   │   ├── app.js          # Express app
│   │   └── server.js       # entry point
│   └── tests/              # node:test + Supertest suites
├── docs/                   # API, deployment, checklist & test report
└── scripts/                # optional browser QA scripts (screenshots, E2E smoke)
```

## 2. Prerequisites

- **Node.js 20.19+** (developed and tested on Node 22) and npm 10
- **PostgreSQL 15+** (tested on PostgreSQL 16) — the schema uses `gen_random_uuid()` and `NULLS NOT DISTINCT` unique indexes.

## 3. Database setup

Create a database user and two databases — one for development, one **disposable** database for automated tests:

```sql
CREATE USER global360 WITH PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE global360 OWNER global360;
CREATE DATABASE global360_test OWNER global360;
```

## 4. Environment configuration

```bash
cp server/.env.example server/.env              # development settings
cp server/.env.test.example server/.env.test    # test settings (must use the *_test database)
cp client/.env.example client/.env              # optional; defaults work for local dev
```

Edit `server/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql://global360:PASSWORD@localhost:5432/global360` |
| `JWT_SECRET` | Long random secret (≥ 32 chars). Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | Browser origin(s) of the SPA, comma-separated (CORS allowlist) |
| `PUBLIC_APP_URL` | Public site URL printed in certificate verification links/QR codes |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `true` / `lax` in production over HTTPS |
| `GROQ_API_KEY` | Optional Groq API key for the signed-in learning assistant; keep it only in `server/.env` |
| `GROQ_MODEL` | Groq chat model (defaults to `openai/gpt-oss-120b`) |
| Certificate fees | Set per course in the course editor and per internship program in the program editor; set to `0` for free certificates |
| `STORAGE_DRIVER` | `local` (dev), `s3` (production), or `none` (uploads disabled) |
| `ENABLE_JOBS` | Run background jobs inside the API process (default `true`) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run db:create-admin` |

The server refuses to start with a clear message if required variables are missing or invalid. Never commit `.env` files (they are git-ignored).

Certificate payment instructions are configurable in **Admin → Settings**. Receipt images are stored through the configured private storage driver, reviewed in **Admin → Certificates → Certificate payment receipts**, and paid certificates can only be downloaded after an authorized admin approves the receipt.

## 5. Install, migrate, seed

```bash
npm install                 # installs both workspaces
npm run db:migrate          # applies all migrations
npm run db:seed             # sample courses, sample instructors, 3 published + 1 archived internship program with 12-week task plans
```

Seeding is idempotent (matched by slug/email) — running it again creates nothing new. All seeded courses and programs are flagged as **sample** content and labelled as such in the UI.

Optional demo accounts and activity (development only, refused in production):

```bash
DEMO_USER_PASSWORD="choose-a-demo-password" npm run db:seed -- --demo
```

This adds `demo.student@example.com` (mid-way through the Data Science internship, with approved, pending, revision-requested and missed tasks), `demo.graduate@example.com` (completed a previous cohort, qualified, certificate issued), `demo.reviewer@example.com` (assigned to all programs), and three pending applicants — all with the password you supply.

Migration commands:

```bash
npm run db:migrate:status   # list executed / pending migrations
npm run db:migrate:undo     # roll back the most recent migration
```

## 6. Create the first admin

There is **no default admin and no hard-coded password.** Set `ADMIN_NAME`, `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` in `server/.env` (or the shell), then:

```bash
npm run db:create-admin
# promote an existing account instead:
npm run db:create-admin -- --promote
```

Remove `ADMIN_PASSWORD` from your environment afterwards. Additional staff (instructors, reviewers, admins) are created by an admin under **Admin → Students & Users → Create staff account**. Public sign-up always creates students.

## 7. Run

```bash
npm run dev            # API on :5000 and Vite on :5173 together (concurrently)
npm run dev:server     # API only (node --watch)
npm run dev:client     # Vite only
```

Open http://localhost:5173. Vite proxies `/api` to the API, so cookies stay first-party in development.

Production-style single server (API also serves the built SPA):

```bash
npm run build                          # builds client/dist
SERVE_CLIENT=true npm start            # http://localhost:5000
```

## 8. Tests and quality checks

```bash
npm test               # backend (node:test + Supertest against global360_test) then frontend (Vitest)
npm run test:server
npm run test:client
npm run lint           # ESLint for server and client
npm run build          # production build of the client
```

Backend tests run migrations on the test database and truncate it between suites; the helper **refuses to run** unless `NODE_ENV=test` and the database name contains `test`. Never point `server/.env.test` at real data.

Optional browser QA (requires `playwright-core` and a Chromium binary): see [`scripts/README.md`](scripts/README.md).

## 9. Key design decisions

- **Sessions:** a signed JWT in an HTTP-only, `SameSite` cookie carries a session id; the session row is checked on every request, so logout, password changes, suspensions and role changes revoke access immediately. Tokens are never stored in `localStorage`.
- **CSRF:** double-submit token — `GET /api/auth/csrf` issues a token (also set as a readable `g360_csrf` cookie); every state-changing request must echo it in `X-CSRF-Token`. Rotated on login.
- **Authorization:** explicit role → permission map (`server/src/utils/permissions.js`) enforced in route middleware **and** resource checks in services (ownership, reviewer assignment, instructor-owned courses). The UI only mirrors it for navigation.
- **Internship rules live in program configuration** — working days, timezone, release/due times, late policy, certificate threshold (default 70%), completion rule, scoring policy and upload limits. One server-side calculator (`scoringService.calculateResults`) produces completion %, score and eligibility for dashboards, reports and certificate issuance.
- **Task completion ≠ performance score ≠ eligibility.** They are computed and displayed separately everywhere.
- **Scoring:** final score = Σ finalized marks on required tasks ÷ Σ max marks of required tasks × 100, half-up rounded to 2 decimals; unsubmitted required tasks count as zero; optional tasks are excluded; the latest current finalized assessment per task is used. No final score is issued while required submissions await review/revision or before the end date.
- **Certificates:** issued only after the program end date, when all checks pass. Issuance runs in a transaction with a row lock and a unique `enrollmentId` constraint, so it is idempotent even under concurrent calls. Revocation is a separate, audited admin action.
- **Uploads:** parsed in memory with hard limits, validated by real file signature (magic bytes) + extension + size against program policy, stored under random keys in private storage, served only to the owner/assigned reviewer/admin as attachments with `nosniff` and a sandbox CSP (or short-lived signed URLs on S3).
- **Audit log:** application decisions, program configuration changes, task schedule changes, assessments and amendments, certificate issuance/revocation, role and account changes.
- **No invented data:** ratings, counts and statistics are database queries; contact details and social links appear only once an admin enters them; sample content is labelled.

## 10. Brand assets

The logo is a reusable component (`client/src/components/common/Logo.jsx`, plus `client/public/favicon.svg`). To use a supplied logo, replace `LogoMark` with an `<img>`. Illustrations are original SVGs in `Illustrations.jsx`; course covers fall back to generated, category-themed artwork when no `thumbnailUrl` is set or an image fails to load.

## 11. Further reading

- [`docs/API.md`](docs/API.md) — endpoints, roles and response format
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production checklist, storage, backups, jobs
- [`docs/CHECKLIST.md`](docs/CHECKLIST.md) — feature checklist, test results, known limitations
