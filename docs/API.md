# Global360 REST API

Base path: `/api`. All responses are JSON.

- **Success:** `{ "data": … }` or, for lists, `{ "data": [ … ], "meta": { "page", "pageSize", "total", "totalPages" } }`
- **Error:** `{ "error": { "code", "message", "details"? } }` — `details` lists `{ field, message }` for validation errors (HTTP 422).
- **Status codes:** 200, 201, 204, 400 (business rule), 401 (not logged in), 403 (no permission / CSRF), 404, 409 (conflict/duplicate/not allowed in current state), 413, 422 (validation), 429 (rate limited), 503.

## Authentication & CSRF

1. `GET /api/auth/csrf` → `{ data: { csrfToken } }` (also sets the `g360_csrf` cookie).
2. Send `X-CSRF-Token: <token>` on every `POST/PUT/PATCH/DELETE`, with credentials (cookies) included.
3. Login/registration set the HTTP-only `g360_session` cookie and return a rotated `csrfToken`.

Never send a user id or role from the browser for authorization; the server derives identity from the session.

Pagination: `page` (≥1), `pageSize` (1–50, task lists up to 100). Larger values are rejected (422).

## Roles and permissions

| Role | Permissions |
|---|---|
| student | `learning:use`, `internship:participate` |
| instructor | `learning:use`, `courses:manage-own` |
| reviewer | `learning:use`, `submissions:review-assigned` |
| admin | all of the above plus `courses:manage`, `users:manage`, `roles:manage`, `internships:manage`, `applications:manage`, `submissions:review-all`, `assessments:amend`, `certificates:manage`, `messages:manage`, `settings:manage`, `reports:view` |

## General & public

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | DB + storage status |
| GET | `/home` | – | Featured courses, live stats, programs, public settings |
| GET | `/stats` | – | Live platform counts |
| GET | `/settings` | – | Admin-configured public contact/social settings |
| POST | `/contact` | – (rate limited) | `{ name, email, subject, message }` |
| GET | `/courses` | – | `search, category, level, minRating, sort(newest|popular|rating|title), page, pageSize` |
| GET | `/courses/categories` | – | Published categories with counts |
| GET | `/courses/:slug` | optional | Details, curriculum, reviews, related; `viewer` block when logged in |
| GET | `/internships` | – | Published programs with application window state |
| GET | `/internships/tracks` | – | Tracks with program counts |
| GET | `/internships/:slug` | optional | Program details, schedule summary, viewer application/enrollment |
| GET | `/certificates/verify/:certificateNumber` | – | Public verification (holder, program, track, dates, status only) |

## Auth & profile

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/csrf` | – | Issue CSRF token |
| POST | `/auth/register` | – (rate limited) | `{ name, email, password }` → always a student |
| POST | `/auth/login` | – (rate limited) | `{ email, password }` |
| POST | `/auth/logout` | – | Revokes the session server-side |
| GET | `/auth/me` | – | `{ user }` or `{ user: null }` |
| POST | `/auth/change-password` | user | `{ currentPassword, newPassword }`; signs out other sessions |
| PATCH | `/auth/profile` | user | `name, phone, headline, bio, avatarUrl, preferences` (role/email not editable) |

Password reset by email is **not implemented** because no email provider is configured; the login page directs users to the contact form.

## Learning (authenticated)

| Method | Path | Description |
|---|---|---|
| POST | `/courses/:courseId/enroll` | Enroll in a free published course (409 if already enrolled) |
| PUT | `/courses/:courseId/review` | `{ rating 1–5, comment }` — enrolled students, one review each |
| POST | `/courses/:courseId/wishlist` | Toggle wishlist |
| GET | `/lessons/:lessonId` | Lesson + outline + navigation. Preview lessons are public; others need enrollment, admin or the course instructor |
| POST | `/lessons/:lessonId/complete` | `{ completed: boolean }` — idempotent progress record |
| POST | `/ai-assistant/chat` | Signed-in users only; `{ messages: [{ role: "user"|"assistant", content }] }` (up to 10 messages) → `{ reply }`; rate limited |
| GET | `/student/dashboard` | Stats, recent courses, recent activity |
| GET | `/student/courses` | Enrolled courses with progress + continue lesson |
| GET | `/student/progress` | Overall and per-course progress |
| GET | `/student/wishlist` | Wishlisted courses |
| POST | `/student/certificate-payments/:certificateType/:certificateId/receipt` | Owner only; `certificateType` is `course` or `internship`; multipart `receipt` image (JPG/PNG/WEBP, max 5 MB) |

## Internship (participant)

| Method | Path | Description |
|---|---|---|
| POST | `/internships/:programId/applications` | Students only. `{ fullName, phone?, education?, experience?, skills?, motivation, portfolioUrl? }` — email comes from the account |
| GET | `/student/internship/applications` | Own applications (no internal notes) |
| POST | `/student/internship/applications/:id/withdraw` | Withdraw a pending/under-review/waitlisted application |
| GET | `/student/internship` | Dashboard: enrollment, current week, results, deadlines, today's tasks, feedback, certificate |
| POST | `/student/internship/withdraw` | `{ reason? }` withdraw from an active enrollment |
| GET | `/student/internship/tasks?week=N` | Week calendar (7 days, day types) with participant task states |
| GET | `/student/internship/tasks/:taskId` | Task details + submission policy + `canSubmit` (403 before release) |
| GET | `/student/internship/tasks/:taskId/submissions` | Own version history with assessments |
| POST | `/student/internship/tasks/:taskId/submissions` | `multipart/form-data`: `submissionText`, `repositoryUrl`, `liveUrl`, `files[]` |
| GET | `/student/internship/progress` | Results, weekly scores, skills, all task states |
| GET | `/student/internship/certificate` | Eligibility checks and certificate (if issued) |
| GET | `/student/internship/certificate/download` | PDF (owner only, valid certificates only) |
| GET | `/attachments/:id` | Private file — owner, assigned reviewer or admin |

Participant task states: `scheduled`, `available`, `submitted`, `under_review`, `revision_required`, `approved`, `rejected`, `overdue`.

## Notifications (authenticated)

`GET /notifications?unreadOnly&page&pageSize`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`.

## Administration (`/api/admin`, permission per route)

**Dashboard & users** — `GET /dashboard` · `GET/POST /users` · `GET/PATCH /users/:id` (role/status; no self-changes; last admin protected) · `GET /instructors` · `GET /reviewers`

**Certificate payments** — `GET /certificate-payments?status=pending|approved|rejected&certificateType=course|internship` · `GET /certificate-payments/:id/receipt` (private image) · `POST /certificate-payments/:id/review` `{ decision: approve|reject, note? }`. Certificate fees are configured on each course and internship program; zero means free. Bank transfer instructions are managed in Admin → Settings.

**Courses** (admin: all; instructor: own) — `GET/POST /courses` · `GET/PATCH/DELETE /courses/:id` · `GET /courses/:id/enrollments` · `POST /courses/:id/modules` · `PUT /courses/:id/modules/order` · `PATCH/DELETE /modules/:id` · `POST /modules/:id/lessons` · `PUT /modules/:id/lessons/order` · `PATCH/DELETE /lessons/:id` · `GET /enrollments`

**Internship programs** — `GET/POST /internships` · `GET/PATCH/DELETE /internships/:id` (schedule changes with published tasks require `confirmScheduleChange: true`) · `POST /internships/:id/holidays` · `DELETE /internships/:id/holidays/:holidayId` · `POST /internships/:id/reviewers` `{ reviewerId, enrollmentId? }` · `DELETE /internships/:id/reviewers/:assignmentId` · `POST /internships/:id/tasks` · `POST /internships/:id/tasks/generate` `{ plan: [...], publish }` · `GET /internships/:id/task-times?date=` · `POST /internships/:id/evaluate`

**Applications** — `GET /internship-applications` · `GET /internship-applications/:id` · `POST /internship-applications/:id/decision` `{ status: under_review|approved|rejected|waitlisted, publicFeedback?, internalNotes? }`

Valid transitions: pending → under_review/approved/rejected/waitlisted; under_review → approved/rejected/waitlisted; waitlisted → under_review/approved/rejected. Approval creates the enrollment in the same transaction and enforces capacity.

**Enrollments** — `GET /internship-enrollments` · `GET /internship-enrollments/:id` · `POST /internship-enrollments/:id/status` `{ status: in_progress|withdrawn|suspended, reason }` · `POST /internship-enrollments/:id/evaluate`

**Tasks** — `GET /internship-tasks` · `GET/PATCH/DELETE /internship-tasks/:id` · `POST /internship-tasks/:id/status` `{ draft|published|archived }`. Changing the schedule, marks or required flag of a released task requires `changeReason` (audited; participants notified of deadline changes). Tasks with submissions cannot be deleted.

**Reviews** (assigned reviewers + admins) — `GET /internship-submissions` (filters: `programId, taskId, participant, status, assignedToMe, submittedFrom, submittedTo, dueBefore, sort`) · `GET /internship-submissions/programs` · `GET /internship-submissions/:id` · `POST /internship-submissions/:id/start-review` · `POST /internship-submissions/:id/assessments` `{ decision: approve|request_revision|reject, marksAwarded, feedback }` · `POST /internship-assessments/:id/amend` (admin) `{ decision, marksAwarded, feedback, reason }`

**Certificates** — `GET /internship-certificates` · `GET /internship-certificates/:id/download` · `POST /internship-certificates/:id/revoke` `{ reason }`

**Reports, messages, audit, settings** — `GET /internship-reports/:id` · `GET /internship-reports/:id/participants.csv` · `GET /messages` · `PATCH /messages/:id` · `GET /audit-logs` · `GET/PUT /settings`

## Rate limits

General API 300 req/min/IP · login/register/password change 20 per 15 min · contact 5/hour · applications 10/hour · uploads 60/hour. Disabled only in the test environment.
