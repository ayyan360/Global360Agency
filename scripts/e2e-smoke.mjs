import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
const base = process.env.BASE || 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const b = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const errors = [];
const pages = [];
const step = (m) => console.log('✔', m);
const browsers = [];
async function newPage() {
  // One browser per user: the packaged Chromium runs single-process and shares cookies across contexts.
  const br = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
  browsers.push(br);
  const ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  pages.push(p);
  return p;
}
async function login(p, email, pw_) {
  await p.goto(`${base}/login`);
  await p.fill('input[type=email]', email);
  await p.fill('input[type=password]', pw_);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login')), p.click('button[type=submit]')]);
}
try {
  // 1. Register + apply
  const s = await newPage();
  const email = `e2e.${Date.now()}@example.com`;
  await s.goto(`${base}/register`);
  await s.getByLabel('Full name').fill('E2E Learner');
  await s.getByLabel('Email address').fill(email);
  await s.getByLabel('Password', { exact: true }).fill('E2ePass123');
  await s.getByLabel('Confirm password').fill('E2ePass123');
  await s.getByRole('checkbox').check();
  await Promise.all([s.waitForURL('**/student'), s.getByRole('button', { name: 'Create account' }).click()]);
  step('registered via UI and landed on /student');
  await s.goto(`${base}/courses/web-development-fundamentals`);
  await s.getByRole('button', { name: 'Enroll for Free' }).click();
  await s.waitForURL('**/learn/**');
  await s.getByRole('button', { name: 'Mark as Complete' }).click();
  await s.waitForTimeout(800);
  step(`enrolled and completed a lesson (now at ${new URL(s.url()).pathname})`);
  await s.goto(`${base}/internship/apply/web-development-internship`);
  await s.getByLabel('Phone number').fill('+92 300 1112233');
  await s.getByLabel('Why do you want to join?').fill('I want hands-on experience building full-stack applications with feedback.');
  await s.getByRole('checkbox').check();
  await s.getByRole('button', { name: 'Submit Application' }).click();
  await s.getByText('Application submitted').waitFor();
  step('submitted internship application via UI');

  // 2. Admin approves
  const a = await newPage();
  await login(a, 'admin@example.com', 'LocalDevAdmin2026');
  await a.goto(`${base}/admin/internship-applications?search=${encodeURIComponent('E2E Learner')}`);
  await a.getByRole('link', { name: 'E2E Learner' }).first().click();
  await a.getByRole('button', { name: 'Approve' }).click();
  await a.getByText('Enrollment created', { exact: true }).waitFor();
  step('admin approved application; enrollment created');

  // 3. Admin assesses a pending submission
  await a.goto(`${base}/admin/reviews`);
  await a.locator('tbody tr').first().click();
  await a.waitForURL('**/admin/reviews/**');
  await a.getByLabel(/^Marks/).fill('8');
  await a.getByLabel('Feedback to participant').fill('Clear analysis and well documented. Nice work.');
  await a.getByRole('button', { name: 'Finalize assessment' }).click();
  await a.getByRole('dialog').getByRole('button', { name: 'Finalize', exact: true }).click();
  await a.getByText('This submission has a finalized assessment.').waitFor();
  step('reviewer workflow: finalized an assessment via UI');

  // 4. Demo student submits a revision with a file
  const d = await newPage();
  await login(d, 'demo.student@example.com', 'DemoPass2026');
  await d.goto(`${base}/student/internship/progress`);
  const revRow = d.locator('tr').filter({ hasText: /Revision Required|Overdue/ }).first();
  await revRow.getByRole('link').click();
  await d.waitForURL('**/student/internship/tasks/**');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d6f1a40000000049454e44ae426082', 'hex');
  await d.locator('input[type=file]').setInputFiles({ name: 'revision.png', mimeType: 'image/png', buffer: png });
  await d.getByLabel('Description / explanation').fill('Added summary statistics and documented the cleaning steps.');
  await d.getByRole('button', { name: 'Submit for review' }).click();
  await d.getByText('Your work was submitted for review.').waitFor();
  step('student submitted a revision with a file upload via UI');

  // 5. Certificate download + verification
  const g = await newPage();
  await login(g, 'demo.graduate@example.com', 'DemoPass2026');
  await g.goto(`${base}/student/internship/certificate`);
  const [download] = await Promise.all([g.waitForEvent('download'), g.getByRole('button', { name: /Download Certificate/ }).click()]);
  const path = await download.path();
  const fs = await import('node:fs');
  const head = fs.readFileSync(path).subarray(0, 4).toString();
  if (head !== '%PDF') throw new Error('Downloaded file is not a PDF');
  fs.copyFileSync(path, `${OUT}/certificate.pdf`);
  step(`graduate downloaded certificate PDF (${download.suggestedFilename()})`);

  // 6. Admin creates a course via the form
  await a.goto(`${base}/admin/courses/new`);
  await a.getByLabel('Title').fill('E2E Created Course');
  await a.getByLabel('Short description').fill('A course created by the end-to-end test.');
  await a.getByLabel('Full description').fill('This course was created through the admin interface during an automated test run.');
  await a.getByLabel('Category').fill('Testing');
  await a.getByRole('button', { name: 'Create course' }).click();
  await a.waitForURL(/\/admin\/courses\/[0-9a-f-]{36}$/);
  await a.getByRole('tab', { name: 'Modules & lessons' }).click();
  await a.getByRole('button', { name: 'Add first module' }).click();
  await a.getByLabel('Module title').fill('Getting started');
  await a.getByRole('button', { name: 'Save module' }).click();
  await a.getByText('Getting started').waitFor();
  step('admin created a course and module via UI');
} catch (e) {
  console.error('✘ E2E FAILED:', e.message.split('\n')[0]);
  for (const [i, pg] of pages.entries()) { console.log('page', i, pg.url()); await pg.screenshot({ path: `${OUT}/fail_${i}.png` }).catch(() => {}); }
  process.exitCode = 1;
} finally {
  if (errors.length) console.log('Page errors:', [...new Set(errors)]);
  for (const br of browsers) await br.close();
  await b.close();
}
