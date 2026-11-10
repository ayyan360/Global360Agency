import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabase, createUser, agentFor, createProgram, createTask, enroll, closeDb } from './helpers.js';
import { Notification, InternshipTask, AuditLog } from '../src/models/index.js';
import { runAllJobs } from '../src/jobs/index.js';

describe('Admin task scheduling API and background jobs', () => {
  let admin;
  let program;
  before(async () => {
    await resetDatabase();
    admin = await agentFor(await createUser('admin'));
    // Mon 2 Nov 2026 – Fri 22 Jan 2027
    program = await createProgram({ startDate: '2026-11-02', endDate: '2027-01-22', timezone: 'Asia/Karachi' });
  });
  after(closeDb);

  it('creates tasks on working days and rejects weekends and holidays unless an exception is allowed', async () => {
    const body = { title: 'Weekday task', description: 'Description text here', instructions: 'Instructions text here', status: 'published' };
    const ok = await admin.post(`/api/admin/internships/${program.id}/tasks`).send({ ...body, scheduledDate: '2026-11-03' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.availableAt, '2026-11-03T04:00:00.000Z', '09:00 Asia/Karachi');
    const sat = await admin.post(`/api/admin/internships/${program.id}/tasks`).send({ ...body, scheduledDate: '2026-11-07' });
    assert.equal(sat.status, 400);
    assert.equal(sat.body.error.code, 'NON_WORKING_DAY');
    await admin.post(`/api/admin/internships/${program.id}/holidays`).send({ date: '2026-11-10', name: 'Test holiday' });
    const hol = await admin.post(`/api/admin/internships/${program.id}/tasks`).send({ ...body, scheduledDate: '2026-11-10' });
    assert.equal(hol.status, 400);
    const exception = await admin.post(`/api/admin/internships/${program.id}/tasks`).send({ ...body, scheduledDate: '2026-11-07', allowNonWorkingDay: true });
    assert.equal(exception.status, 201);
    const outside = await admin.post(`/api/admin/internships/${program.id}/tasks`).send({ ...body, scheduledDate: '2027-02-01' });
    assert.equal(outside.status, 400);
  });

  it('bulk generation skips non-working days and reports them instead of silently moving tasks', async () => {
    const plan = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekNumber: 2, scheduledDay: d, title: `W2 day ${d}`, description: 'Generated task description', instructions: 'Generated task instructions' }));
    const res = await admin.post(`/api/admin/internships/${program.id}/tasks/generate`).send({ plan });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.created.length, 4, 'Mon, Wed, Thu, Fri (Tue 10 Nov is a holiday)');
    assert.deepEqual(res.body.data.skipped.map((s) => s.reason).sort(), ['day_off', 'day_off', 'holiday']);
  });

  it('requires a reason to change the deadline of a released task and audits it', async () => {
    const released = await createTask(program, { availableAt: new Date(Date.now() - 3600000) });
    await released.update({ scheduledDate: '2026-11-04' });
    const noReason = await admin.patch(`/api/admin/internship-tasks/${released.id}`).send({ scheduledDate: '2026-11-05' });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body.error.code, 'CHANGE_REASON_REQUIRED');
    const withReason = await admin.patch(`/api/admin/internship-tasks/${released.id}`).send({ scheduledDate: '2026-11-05', changeReason: 'Mentor unavailable on the original day' });
    assert.equal(withReason.status, 200);
    const log = await AuditLog.findOne({ where: { action: 'task.updated', entityId: released.id } });
    assert.equal(log.metadata.reason, 'Mentor unavailable on the original day');
  });

  it('refuses to delete tasks that have submissions', async () => {
    const t = await InternshipTask.findOne({ where: { title: 'Weekday task' } });
    const student = await createUser('student');
    const e = await enroll(student, program);
    const { TaskSubmission } = await import('../src/models/index.js');
    await TaskSubmission.create({ taskId: t.id, enrollmentId: e.id, version: 1, submissionText: 'x', status: 'submitted' });
    assert.equal((await admin.delete(`/api/admin/internship-tasks/${t.id}`)).status, 409);
  });

  it('scheduled jobs can run repeatedly without duplicating notifications', async () => {
    const running = await createProgram();
    const t = await createTask(running, { availableAt: new Date(Date.now() - 3600000), dueAt: new Date(Date.now() + 3 * 3600000) });
    const student = await createUser('student');
    await enroll(student, running, 'approved'); // program already started → job activates it
    const first = await runAllJobs();
    assert.equal(first.activated >= 1, true);
    await runAllJobs();
    await runAllJobs();
    const available = await Notification.count({ where: { userId: student.id, type: 'task_available', resourceId: t.id } });
    const reminders = await Notification.count({ where: { userId: student.id, type: 'deadline_reminder', resourceId: t.id } });
    assert.equal(available, 1);
    assert.equal(reminders, 1);
  });
});
