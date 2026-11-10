# Global360 — Feature Checklist & Test Report

Status key: ✅ implemented and verified by automated tests and/or the browser E2E run · 🟢 implemented and manually verified (screenshots/API) · ⚙️ implemented, requires external configuration to use · ⛔ not implemented (reason given)

Verification environment: Automated tests, lint, production build, and dependency checks run in the current Windows workspace. Date of report: 10 November 2026.

## 1. Definition-of-done checklist

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Global360-branded monorepo (npm workspaces) | ✅ | Root scripts verified: `npm run lint`, `npm test`, `npm run build` |
| 2 | Responsive white-and-violet UI closely matching the references | 🟢 | Screenshots compared at 1440/768/390 px; no horizontal overflow detected on any checked page |
| 3 | Public education website | ✅ | Home, About, Contact, Privacy, Terms, 404/401/403, error boundary |
| 4 | Working course catalog | ✅ | Search, category, level, rating filters, 4 sort orders, pagination — `courses.test.js` |
| 5 | Course details and curriculum | ✅ | Breadcrumbs, tabs, accordion curriculum, instructor, reviews, related courses |
| 6 | Registration and authentication | ✅ | `auth.test.js` (11 tests) + E2E registration |
| 7 | Student dashboard | ✅ | DB-derived stats, courses, recent activity |
| 8 | Course enrollment | ✅ | Duplicate prevention (409 + unique index) — tests + E2E |
| 9 | Lesson player and progress persistence | ✅ | Preview/enrollment access rules, idempotent progress, course completion — tests + E2E |
| 10 | Admin dashboard | ✅ | Live statistics, recent enrollments, 14-day trend |
| 11 | Course, module and lesson management | ✅ | CRUD, ordering, publish/archive, instructor scoping — tests + E2E |
| 12 | Internship landing page | 🟢 | Hero, highlights, how it works, tracks (DB), why join, FAQ, eligibility, CTA |
| 13 | Internship program management | ✅ | Dates, working days, timezone, holidays, threshold, scoring/completion/submission policies, reviewers |
| 14 | Application and approval workflow | ✅ | `applications.test.js` (9 tests) + E2E approval |
| 15 | Three-month internship scheduling | ✅ | Real program dates, 12-week plans, leap year, DST — `scheduling.test.js` |
| 16 | Monday-to-Friday task schedule | ✅ | 60 working days in a 12-week program |
| 17 | Saturday and Sunday off by default | ✅ | Weekend/holiday task creation rejected unless an explicit exception is chosen |
| 18 | Daily task submission | ✅ | Text, repository URL, live URL, files; versioning — `submissions.test.js` + E2E |
| 19 | Secure upload handling | ✅ | Magic-byte validation, extension + size limits, random keys, private storage, path-traversal guard, `nosniff` + sandbox CSP |
| 20 | Mentor assessment and feedback | ✅ | Approve / request revision / reject, marks range, finalization, history, admin amendment — tests + E2E |
| 21 | Completion progress calculation | ✅ | `scoring.test.js` |
| 22 | Final performance score calculation | ✅ | Weighted by max marks, missing = 0, optional excluded, latest finalized assessment, half-up rounding |
| 23 | Configurable certificate threshold (default 70%) | ✅ | Stored per program; single source for UI, scoring and issuance |
| 24 | Server-side certificate eligibility | ✅ | All 7 eligibility rules tested (unit + integration) |
| 25 | Downloadable PDF certificates | ✅ | PDFKit, QR verification link; owner-only download — tests + E2E |
| 26 | Unique certificate identifiers | ✅ | `G360-YYYY-XXXXXXXX`, unique constraints on number and enrollment |
| 27 | Public certificate verification | ✅ | Only approved fields; revoked/unknown handled |
| 28 | Notifications for important events | ✅ | Stored in-app; job deduplication tested |
| 29 | Secure role and resource authorization | ✅ | `authorization.test.js` (IDOR, escalation, reviewer scope) |
| 30 | PostgreSQL migrations and seeders | ✅ | Up/down/up verified; idempotent seeding verified |
| 31 | Automated tests for critical workflows | ✅ | 108 backend + 21 frontend tests passing |
| 32 | Production build and documented deployment | ✅ | `npm run build` passes; `docs/DEPLOYMENT.md`; production environment validation fails closed |
| 33 | Complete README | ✅ | `README.md` |
| 34 | Implementation checklist and honest test report | ✅ | This document |

## 2. Test results (actual runs)

### Backend — `npm run test:server` (Node test runner + Supertest, `global360_test` database)

```
# tests 108
# suites 13
# pass 108
# fail 0
```

| Suite | Tests | Covers |
|---|---|---|
| `auth.test.js` | 11 | Registration, role injection ignored, duplicate email, validation, login/wrong password, CSRF enforcement, logout revocation (stolen cookie replay rejected), suspended accounts, role authorization, password change revokes other sessions, profile cannot change role |
| `courses.test.js` | 9 | Published-only listing, no invented ratings, search/filter/sort + invalid sort rejected, details & drafts hidden, enrollment & duplicates, lesson access control, progress persistence & course completion, contact messages, admin CRUD + PATCH-doesn't-reset-fields + instructor scoping |
| `scheduling.test.js` | 10 | Mon–Fri generation, weekend exclusion, holidays, custom working days, real dates & leap years, week/day resolution, timezone release/due times, DST transitions, start/end boundaries, no premature release |
| `scoring.test.js` | 18 | Completion vs score separation, weighting, pending not counted, missing/overdue = 0, latest version, optional tasks, rounding, no-required-tasks safety, revision unresolved, eligibility rules 1–7, configurable threshold |
| `applications.test.js` | 9 | Valid/invalid applications, duplicates, application window, transactional approval + enrollment, rejection feedback + invalid transitions, capacity, admin-only access, students only |
| `submissions.test.js` | 14 | Valid upload, fake file content rejected, disallowed types & URLs, resubmission/superseding history, attachment privacy, unassigned reviewers blocked, marks validation, revision cycle, finalization not overwritten, students can't assess, audited amendment, unreleased tasks, late policy, withdrawn participants |
| `certificates.test.js` | 12 | Exactly 70% eligible, above 70%, below 70% not qualified, not ended, incomplete tasks, pending assessments, withdrawn, idempotent/concurrent issuance + DB constraint, owner-only download, public fields only, revocation, students/reviewers can't revoke |
| `authorization.test.js` | 10 | Cross-student IDOR, private notifications, no admin creation/role escalation, self-demotion blocked, sessions revoked on role change, reviewer limits, students can't change thresholds/enrollments/tasks, pagination limits & malformed IDs, health endpoint, no password hashes |
| `jobs-and-tasks.test.js` | 5 | Working-day task API + exceptions, bulk generation skips & reports non-working days, released-task change reason + audit, deletion blocked with submissions, jobs repeatable without duplicate notifications |
| `productionConfig.test.js` | 2 | Insecure production configuration rejected; valid HTTPS/S3/database TLS configuration accepted |

### Frontend — `npm run test:client` (Vitest + React Testing Library)

```
Test Files  4 passed (4)
     Tests  21 passed (21)
```

Covers embed-URL safety, formatters, status labels, accessible inputs/password toggle, progress bars, results summary (separate completion/score/eligibility), eligibility checklist, file-upload pre-checks, course card, pagination, chart data table, login validation and server errors, route guards (anonymous and missing-permission), revoked-certificate verification display.

### Browser end-to-end smoke run (`scripts/e2e-smoke.mjs`, headless Chromium against the production build)

```
✔ registered via UI and landed on /student
✔ enrolled and completed a lesson
✔ submitted internship application via UI
✔ admin approved application; enrollment created
✔ reviewer workflow: finalized an assessment via UI
✔ student submitted a revision with a file upload via UI
✔ graduate downloaded certificate PDF
✔ admin created a course and module via UI
```

### Lint and build

- `npm run lint` — 0 errors, 0 warnings (server and client)
- `npm run build` — succeeds (Vite 8). Largest chunk: React vendor bundle ≈ 80 kB gzip; pages are lazy-loaded.

## 3. Verified vs. requires configuration

**Verified locally:** everything in §1 marked ✅/🟢 using local PostgreSQL and the local storage driver.

**Implemented but not exercised against real production services (⚙️):**
- **S3-compatible storage driver** (`STORAGE_DRIVER=s3`) — implemented with the AWS SDK (private objects, signed download URLs) but not tested against a real bucket in this environment.
- **YouTube/Vimeo embeds** — the player converts URLs to privacy-friendly embeds and the CSP allows them, but outbound access to YouTube was blocked in the build environment, so playback itself was not observed. The sample preview lessons reference public freeCodeCamp videos; confirm they still exist or replace the URLs.

## 4. Not implemented (deliberately) and known limitations

- ⛔ **Email delivery and password-reset emails** — no email provider is configured, so per the brief neither is faked. "Forgot password?" routes to the contact form; admins can reset access by creating a new staff account or changing account status. All notifications are in-app.
- ⛔ **Google/GitHub OAuth** — not configured, so no social login buttons are shown.
- **Images:** course covers are generated, category-themed artwork (with optional `thumbnailUrl` per course) and illustrations are original SVGs rather than the stock photos/3D art in the reference boards. Layout, proportions, colours and components follow the references; this is not a pixel-perfect reproduction.
- **Module/lesson ordering** uses up/down buttons rather than drag and drop.
- **Instructor role** can manage only their own courses and see their enrollments; there is no separate instructor analytics dashboard.
- **Scale:** participant lists and CSV exports calculate results per enrollment in the API. This is fine for hundreds of participants per page; very large programs would benefit from caching results on the enrollment row.
- **Accessibility:** semantic landmarks, labels, focus styles, keyboard-operable dialogs and ARIA on progress/charts are in place and partly covered by tests; a full automated (axe) or screen-reader audit has not been run.
- **Browsers:** visual QA used headless Chromium only; Safari and Firefox were not tested.
- **Data rights tooling** (self-service account deletion/export) is not implemented; handle requests via support.
- **Dependency audit (10 November 2026):** the compatible `npm audit fix` removed the high-severity production advisories. Remaining moderate findings are `uuid@8` via Sequelize (the advisory concerns caller-supplied buffers, which this app does not pass) and `minimatch` in the ESLint 10 development toolchain. `npm audit fix --force` proposes breaking major-version changes; do not use it without a deliberate migration.
- **Legal pages** are templates and must be reviewed before launch.

## 5. Required external credentials / services for production

PostgreSQL 15+ database · unique `JWT_SECRET` (≥64 chars) · HTTPS · TLS-verified PostgreSQL connection · private S3-compatible bucket and keys (for uploads and stored certificates) · public site URL for certificate links.
