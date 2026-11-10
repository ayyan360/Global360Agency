# Browser QA scripts (optional)

These scripts drive a real Chromium browser against a running Global360 server. They are not part of `npm test` because they need a browser binary.

Setup (outside the repo, or add as dev dependencies):

```bash
npm i -D playwright-core
npx playwright install chromium   # or point CHROMIUM_PATH to an existing Chrome/Chromium
```

The scripts as written use `@sparticuz/chromium` (a Chromium build distributed via npm) because the standard Playwright download was unavailable in the build environment. To use a normal Playwright install, replace the `executablePath`/`args` lines with `chromium.launch()`.

- `screenshots.mjs <outDir> <width> <login:email:password|-> <path...>` — full-page screenshots, reports horizontal overflow and console errors.
- `e2e-smoke.mjs` — registers a learner, enrolls and completes a lesson, applies for an internship, approves it as admin, assesses a submission, uploads a revision as the demo student, downloads a certificate as the demo graduate and creates a course as admin. Requires the demo seed (`DEMO_USER_PASSWORD=DemoPass2026 npm run db:seed -- --demo`) and an admin `admin@example.com` / `LocalDevAdmin2026`; adjust the constants at the top for your environment.

Run against the production build: `npm run build && SERVE_CLIENT=true npm start`, then `BASE=http://localhost:5000 node scripts/screenshots.mjs …`.
