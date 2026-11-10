# Global360 Project Guide

## What this project is

Global360 is a full-stack learning platform with a free internship management system. It combines a public website and course catalog, student learning dashboards, and an end-to-end internship workflow for applications, scheduled tasks, reviews, scoring, and certificates.

The repository is an npm-workspaces monorepo:

- `client/` is the React single-page application, built with Vite.
- `server/` is the Express REST API and background-job runner.
- PostgreSQL stores users, courses, learning progress, internship records, settings, notifications, and audit history.
- `docs/` contains the API reference, deployment notes, feature checklist, and this guide.

## Features by audience

### Public visitors

- Browse the home page, platform information, contact page, privacy and terms pages.
- Search and filter the course catalog by category, level, rating, and sort order; view course details, curriculum, instructor information, reviews, and related courses.
- Browse internship programs and tracks, see program and application-window details, and apply after creating a student account.
- Verify an internship certificate using its public certificate number. Only approved verification details are returned.
- Send a contact message. The contact endpoint is rate-limited.

### Students

- Register and sign in, update account profile details, and change passwords.
- View a personalized dashboard with learning activity and database-derived statistics.
- Enroll in published free courses, maintain a wishlist, view course progress, and continue lessons. Lesson completion is persisted and safe to repeat.
- Submit course reviews when eligible and download a course certificate where available.
- Apply to internship programs, view application status, and withdraw an application while its status permits.
- For an active internship, see the dashboard, weekly task calendar, available task details, submission history, deadlines, reviewer feedback, progress, and certificate eligibility.
- Submit task work as text, repository/live URLs, and permitted files; resubmit when a reviewer requests changes.
- Receive in-app notifications and manage profile information.

### Instructors

- Manage their own courses, including course content, modules, and lessons.
- View enrollments for courses they own.
- Instructor access is limited to owned courses; it does not grant general administrator access.

### Reviewers and mentors

- View and assess submissions for programs or enrollments assigned to them.
- Approve work, request revisions, or reject submissions, with marks and written feedback.
- Reviewer access is scoped to assigned work; administrators can review across the platform.

### Administrators

- View platform and operational dashboards.
- Manage users, account statuses and staff roles, subject to safeguards such as preventing self-escalation and protecting the last administrator.
- Create and manage courses, modules, lessons, enrollments, and course publishing state.
- Create internship programs and configure application dates, capacity, dates, time zone, working days, holidays, release and due times, submission rules, scoring, completion requirements, certificate thresholds, and reviewers.
- Review applications and approve, reject, or waitlist applicants. Approval creates an enrollment transactionally and respects program capacity.
- Generate, publish, edit, and archive program tasks; manage participants and review submissions.
- Amend finalized assessments with an audited reason, evaluate participants, issue or revoke certificates, and access reports and CSV exports.
- Handle contact messages, edit public platform settings, and inspect audit logs.

## How the main workflows work

### Course learning

1. Public course pages load only published catalog content from the API.
2. A signed-in user enrolls in a published free course. The server prevents duplicate enrollment.
3. The learner opens lessons. Preview lessons can be public; other lessons require the appropriate enrollment or staff access.
4. Lesson progress is stored by the server and reflected in the learner dashboard and progress pages.
5. Course managers create and organize courses, modules, and lessons. Instructors are restricted to their own courses.

### Internship participation

1. An administrator configures and publishes an internship program, its application window, policies, schedule, and task plan.
2. A student submits an application. Staff review it and record a decision with optional public feedback and internal notes.
3. Approval creates the participant's enrollment. Tasks follow the program's configured calendar, working days, holidays, release times, and due times.
4. The participant submits work for a released task. The submission may include text, URLs, and validated attachments; versions are retained for review history.
5. An assigned reviewer or administrator assesses the submission. The decision can approve it, request a revision, or reject it. Finalized assessments are not silently overwritten; an administrator amendment is a distinct audited action.
6. The server calculates completion, performance score, and certificate eligibility separately. Required work, missing work, pending review/revision, program dates, and the configured threshold affect the result.
7. Once the program has ended and all eligibility checks pass, the system can issue a uniquely numbered PDF certificate. A public verification endpoint reports its validity; revocation is a separate audited administrator action.

### Authentication and authorization

- Registration always creates a student account. Staff accounts are created or promoted through the administrative process.
- Authentication uses a signed JWT stored in an HTTP-only cookie. The API checks the associated server-side session, allowing logout, password changes, suspension, and role changes to revoke access.
- The browser obtains a CSRF token and sends it in `X-CSRF-Token` on state-changing requests. Login and registration rotate the token.
- The API enforces permissions and resource ownership. Frontend route guards and navigation improve the user experience but do not replace server-side checks.

## How the application is structured

### Frontend

The React application uses React Router for public, student, and admin routes. Public pages render within `PublicLayout`; authenticated workspaces use `DashboardLayout`. Routes are lazy-loaded, guarded by authentication or permissions, and wrapped in an error boundary.

Shared contexts handle authentication, settings, and toast notifications. API requests go through the central Axios client in `client/src/services/api.js`; shared hooks, components, status constants, and form validation keep common behavior consistent. Tailwind CSS 4 and the styles in `client/src/styles/` provide the visual system.

### Backend

The request path is broadly:

1. `server/src/app.js` configures security headers, CORS, logging, body parsing, cookies, API rate limiting, user loading, and CSRF protection.
2. `server/src/routes/` connects endpoints to authentication/permission middleware, request validation, and controllers.
3. Controllers handle HTTP details and delegate business rules to services.
4. Services perform domain operations and interact with Sequelize models and PostgreSQL.
5. Central error handling formats failures into the documented API response shape.

Zod schemas validate request bodies, query parameters, and route parameters. Migrations define database changes, while seeders add repeatable sample content. The server can optionally serve the built client for a single-origin deployment.

### Background work and files

Scheduled jobs support internship task release, reminders, and completion/evaluation work. They can run as part of the API process or through the dedicated jobs script, depending on environment configuration.

Submission files are checked against file type, extension, size, and program policy, then stored using private storage. Local storage is intended for development; an S3-compatible driver is available for deployment. Downloads are authorized for the participant, assigned reviewer, or administrator and are served as attachments.

## Security and integrity rules

- Passwords are hashed; session cookies are HTTP-only, and browser code does not store bearer tokens in local storage.
- CSRF protection, CORS allowlisting, Helmet security headers, and endpoint rate limits are enabled.
- Role checks are combined with resource-level checks to prevent cross-user access and unauthorized reviewer or instructor access.
- Uploads use private storage and randomized object keys; file signatures and policy limits are checked, and download responses use defensive headers.
- Important decisions and changes, including application decisions, program/schedule changes, assessments, certificate actions, and account/role changes, are audited.
- Scoring and certificate eligibility are computed on the server. Completion percentage, performance score, and eligibility are separate values rather than interchangeable indicators.

## Technology

- **Client:** React 19, Vite 8, React Router 7, Axios, React Hook Form, Zod, Tailwind CSS 4, and Lucide icons.
- **Server:** Node.js, Express 5, Sequelize 6, PostgreSQL, Umzug migrations, Zod, and Pino logging.
- **Additional services:** JWT cookies, CSRF protection, `node-cron` jobs, PDFKit certificates, QR codes, and optional AWS S3-compatible storage.
- **Tests:** Node's test runner and Supertest for the API; Vitest and React Testing Library for the client; optional Playwright browser smoke tests.

## Local development

Prerequisites are Node.js 22.12+ or 24+ and PostgreSQL 15+. Configure the server and optional client environment files using the examples in each application. Do not commit real environment files or credentials.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run db:create-admin
npm run dev
```

The development server runs the API and Vite client together. Open `http://localhost:5173`; Vite proxies API calls to the local server. See [`README.md`](../README.md) for database, environment, and test-database setup details.

Useful commands:

```bash
npm run db:migrate:status
npm run db:seed
npm run test
npm run lint
npm run build
```

Backend tests use a separate disposable test database. Follow the database safeguards in the README and `server/tests/helpers.js`; never point test configuration at real or development data.

## Current limitations

- Email delivery and email-based password reset are not implemented; notifications are in-app. The login flow directs password-reset requests to the contact route.
- Google and GitHub sign-in are not configured.
- S3-compatible storage is implemented but requires real bucket credentials and deployment testing.
- Course certificates, where enabled, are separate from the internship certificate workflow.
- Instructor capabilities focus on managing owned courses and viewing their enrollments; there is no separate instructor analytics dashboard.
- Automated accessibility coverage is partial, and browser verification has not covered every browser or assistive technology.
- Legal pages are templates and must be reviewed for the deploying organization.

## Further documentation

- [`README.md`](../README.md): installation, environment setup, database commands, and development workflow.
- [`API.md`](API.md): REST endpoints, roles, request conventions, and response formats.
- [`DEPLOYMENT.md`](DEPLOYMENT.md): production deployment and operational configuration.
- [`CHECKLIST.md`](CHECKLIST.md): feature verification, test report, and known limitations.
