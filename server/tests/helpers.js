/**
 * Test helpers. Tests run with NODE_ENV=test, which loads server/.env.test and MUST point at a
 * separate, disposable database. resetDatabase() refuses to run against anything else.
 */
import request from 'supertest';
import { DateTime } from 'luxon';
import { createApp } from '../src/app.js';
import { createMigrator } from '../src/config/migrator.js';
import {
  sequelize,
  User,
  Course,
  CourseModule,
  Lesson,
  InternshipProgram,
  InternshipTask,
  InternshipApplication,
  InternshipEnrollment,
  InternshipReviewerAssignment,
  TaskSubmission,
  TaskAssessment,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/authService.js';

export const PASSWORD = 'TestPass123';
let migrated = false;

export async function resetDatabase() {
  const [[{ db }]] = await sequelize.query('SELECT current_database() AS db');
  if (process.env.NODE_ENV !== 'test' || !/test/i.test(db)) {
    throw new Error(`Refusing to reset database "${db}" — tests must use a dedicated test database.`);
  }
  if (!migrated) {
    await createMigrator({ logger: undefined }).up();
    migrated = true;
  }
  const tables = (await sequelize.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'SequelizeMeta'`))[0].map((r) => `"${r.tablename}"`);
  await sequelize.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export const app = createApp();

let counter = 0;
export async function createUser(role = 'student', overrides = {}) {
  counter += 1;
  return User.create({
    name: overrides.name || `${role} user ${counter}`,
    email: overrides.email || `${role}${counter}-${Date.now()}@example.com`,
    role,
    passwordHash: await hashPassword(overrides.password || PASSWORD),
    accountStatus: overrides.accountStatus || 'active',
  });
}

/** A supertest agent that keeps cookies and sends the CSRF header automatically. */
export async function agentFor(user) {
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/csrf');
  const token = res.body.data.csrfToken;
  const track = (test) =>
    test.on('response', (r) => {
      const t = r.body?.data?.csrfToken;
      if (t) wrap.token = t;
    });
  const wrap = {
    agent,
    token,
    get: (url) => agent.get(url),
    post: (url) => track(agent.post(url).set('X-CSRF-Token', wrap.token)),
    put: (url) => track(agent.put(url).set('X-CSRF-Token', wrap.token)),
    patch: (url) => track(agent.patch(url).set('X-CSRF-Token', wrap.token)),
    delete: (url) => track(agent.delete(url).set('X-CSRF-Token', wrap.token)),
  };
  if (user) {
    const login = await wrap.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    if (login.status !== 200) throw new Error(`Login failed in test: ${JSON.stringify(login.body)}`);
    wrap.token = login.body.data.csrfToken;
    wrap.sessionCookie = login.headers['set-cookie'].find((c) => c.startsWith('g360_session=')).split(';')[0];
  }
  return wrap;
}

export async function createCourse({ status = 'published', lessons = 3, preview = 1, instructorId = null, title } = {}) {
  counter += 1;
  const course = await Course.create({
    title: title || `Test Course ${counter}`,
    slug: `test-course-${counter}-${Date.now()}`,
    shortDescription: 'A short description for testing.',
    description: 'A longer description used in automated tests.',
    category: 'Testing',
    level: 'beginner',
    status,
    instructorId,
    publishedAt: status === 'published' ? new Date() : null,
  });
  const mod = await CourseModule.create({ courseId: course.id, title: 'Module 1', position: 0 });
  const created = [];
  for (let i = 0; i < lessons; i += 1) {
    created.push(await Lesson.create({ moduleId: mod.id, title: `Lesson ${i + 1}`, position: i, durationSeconds: 300, isPreview: i < preview }));
  }
  return { course, module: mod, lessons: created };
}

const TZ = 'UTC';
export function isoDay(offsetDays, from = DateTime.utc()) {
  return from.plus({ days: offsetDays }).toISODate();
}

/** Monday on/before a date. */
export function mondayOf(dt) {
  return dt.minus({ days: dt.weekday - 1 });
}

export async function createProgram(overrides = {}) {
  counter += 1;
  return InternshipProgram.create({
    title: `Program ${counter}`,
    slug: `program-${counter}-${Date.now()}`,
    shortDescription: 'Short description for testing purposes.',
    description: 'Long description for testing purposes, describing the program.',
    track: 'Web Development',
    startDate: isoDay(-30),
    endDate: isoDay(30),
    timezone: TZ,
    status: 'published',
    certificateThreshold: 70,
    completionRules: { minCompletionPercent: 80 },
    applicationOpenAt: new Date(Date.now() - 86400000),
    applicationCloseAt: new Date(Date.now() + 86400000 * 10),
    ...overrides,
  });
}

/** Creates a published task with explicit times (bypassing schedule validation for test setup). */
export async function createTask(program, { availableAt, dueAt, maxMarks = 10, isRequired = true, status = 'published', title, submissionTypes } = {}) {
  counter += 1;
  const avail = availableAt || new Date(Date.now() - 2 * 86400000);
  const due = dueAt || new Date(avail.getTime() + 86400000);
  return InternshipTask.create({
    programId: program.id,
    title: title || `Task ${counter}`,
    description: 'Task description for tests.',
    instructions: 'Task instructions for tests.',
    weekNumber: 1,
    scheduledDay: 1,
    scheduledDate: DateTime.fromJSDate(avail, { zone: 'utc' }).toISODate(),
    availableAt: avail,
    dueAt: due,
    maxMarks,
    isRequired,
    status,
    ...(submissionTypes ? { submissionTypes } : {}),
  });
}

export async function enroll(user, program, status = 'in_progress') {
  const application = await InternshipApplication.create({
    userId: user.id,
    programId: program.id,
    fullName: user.name,
    email: user.email,
    motivation: 'Motivation text that is long enough for validation rules.',
    status: 'approved',
  });
  return InternshipEnrollment.create({
    userId: user.id,
    programId: program.id,
    applicationId: application.id,
    startDate: program.startDate,
    endDate: program.endDate,
    status,
  });
}

export async function assignReviewer(reviewer, program, enrollment = null) {
  return InternshipReviewerAssignment.create({ programId: program.id, reviewerId: reviewer.id, enrollmentId: enrollment?.id || null });
}

/** Directly records a submission and (optionally) a finalized assessment. */
export async function addAssessed(task, enrollment, reviewer, { marks, decision = 'approve', version = 1 } = {}) {
  const submission = await TaskSubmission.create({
    taskId: task.id,
    enrollmentId: enrollment.id,
    version,
    submissionText: 'Work',
    status: decision ? (decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revision_required') : 'submitted',
    submittedAt: new Date(),
  });
  if (decision) {
    await TaskAssessment.create({
      submissionId: submission.id,
      reviewerId: reviewer.id,
      marksAwarded: marks,
      feedback: 'Feedback',
      decision,
      isFinal: decision !== 'request_revision',
      assessedAt: new Date(),
    });
  }
  return submission;
}

// Minimal valid file bodies (magic bytes) for upload tests.
export const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d6f1a40000000049454e44ae426082',
  'hex'
);
export const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

export async function closeDb() {
  await sequelize.close();
}
