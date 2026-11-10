import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabase, createUser, agentFor, createProgram, createTask, enroll, addAssessed, closeDb } from './helpers.js';
import { User, Notification } from '../src/models/index.js';

describe('Authorization and data isolation', () => {
  let program;
  let task;
  let alice;
  let bob;
  let aliceSubmission;
  let reviewer;
  before(async () => {
    await resetDatabase();
    program = await createProgram();
    task = await createTask(program);
    alice = await createUser('student');
    bob = await createUser('student');
    reviewer = await createUser('reviewer');
    const aliceEnrollment = await enroll(alice, program);
    await enroll(bob, program);
    aliceSubmission = await addAssessed(task, aliceEnrollment, reviewer, { decision: null });
  });
  after(closeDb);

  it("students cannot read another student's submission by changing an ID", async () => {
    const b = await agentFor(bob);
    assert.equal((await b.get(`/api/admin/internship-submissions/${aliceSubmission.id}`)).status, 403);
    const own = await b.get(`/api/student/internship/tasks/${task.id}/submissions`);
    assert.equal(own.status, 200);
    assert.equal(own.body.data.length, 0, "Bob only sees his own (empty) history");
  });

  it('notifications are private to their recipient', async () => {
    const n = await Notification.create({ userId: alice.id, type: 'test', title: 'Private', message: 'For Alice only' });
    const b = await agentFor(bob);
    assert.equal((await b.post(`/api/notifications/${n.id}/read`)).status, 404);
    const list = await b.get('/api/notifications');
    assert.ok(!list.body.data.some((x) => x.id === n.id));
  });

  it('non-admins cannot create admin accounts or change roles', async () => {
    const s = await agentFor(alice);
    assert.equal((await s.post('/api/admin/users').send({ name: 'Evil Admin', email: 'evil@example.com', password: 'Password123', role: 'admin' })).status, 403);
    assert.equal((await s.patch(`/api/admin/users/${alice.id}`).send({ role: 'admin' })).status, 403);
    const r = await agentFor(reviewer);
    assert.equal((await r.patch(`/api/admin/users/${bob.id}`).send({ role: 'admin' })).status, 403);
    await alice.reload();
    assert.equal(alice.role, 'student');
  });

  it('admins cannot escalate or demote themselves, and the last admin is protected', async () => {
    const admin = await createUser('admin');
    const a = await agentFor(admin);
    assert.equal((await a.patch(`/api/admin/users/${admin.id}`).send({ role: 'student' })).status, 403);
    const res = await a.patch(`/api/admin/users/${bob.id}`).send({ role: 'reviewer' });
    assert.equal(res.status, 200);
    await bob.update({ role: 'student' });
  });

  it('role changes are effective immediately and revoke existing sessions', async () => {
    const admin = await agentFor(await createUser('admin'));
    const target = await createUser('reviewer');
    const t = await agentFor(target);
    assert.equal((await t.get('/api/admin/internship-submissions')).status, 200);
    await admin.patch(`/api/admin/users/${target.id}`).send({ role: 'student' });
    assert.equal((await t.get('/api/admin/internship-submissions')).status, 401, 'old session revoked after role change');
  });

  it('reviewers cannot manage programs, tasks or applications', async () => {
    const r = await agentFor(reviewer);
    assert.equal((await r.get('/api/admin/internships')).status, 403);
    assert.equal((await r.patch(`/api/admin/internships/${program.id}`).send({ certificateThreshold: 10 })).status, 403);
    assert.equal((await r.patch(`/api/admin/internship-tasks/${task.id}`).send({ maxMarks: 1 })).status, 403);
  });

  it('students cannot change the certificate threshold, enrollment status or task state', async () => {
    const s = await agentFor(alice);
    assert.equal((await s.patch(`/api/admin/internships/${program.id}`).send({ certificateThreshold: 0 })).status, 403);
    assert.equal((await s.post(`/api/admin/internship-enrollments/${aliceSubmission.enrollmentId}/status`).send({ status: 'in_progress' })).status, 403);
    assert.equal((await s.post(`/api/admin/internship-tasks/${task.id}/status`).send({ status: 'archived' })).status, 403);
    await program.reload();
    assert.equal(Number(program.certificateThreshold), 70);
  });

  it('pagination limits are enforced and malformed IDs are handled safely', async () => {
    const admin = await agentFor(await createUser('admin'));
    assert.equal((await admin.get('/api/admin/users?pageSize=100000')).status, 422);
    assert.equal((await admin.get('/api/admin/users/not-a-uuid')).status, 422);
    assert.equal((await admin.get("/api/courses?search=' OR 1=1 --")).status, 200, 'search input is parameterized');
  });

  it('the health endpoint reports status without secrets', async () => {
    const s = await agentFor();
    const res = await s.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.database, 'ok');
    assert.ok(!JSON.stringify(res.body).includes('postgres'));
  });

  it('every user record omits the password hash in API responses', async () => {
    const admin = await agentFor(await createUser('admin'));
    const res = await admin.get('/api/admin/users');
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((u) => u.passwordHash === undefined));
    assert.ok(await User.count());
  });
});
