import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabase, createUser, agentFor, createProgram, closeDb } from './helpers.js';
import { InternshipEnrollment, InternshipApplication, AuditLog } from '../src/models/index.js';

const validApplication = { fullName: 'Applicant Person', phone: '+92 300 1234567', education: 'BS CS', skills: 'HTML, CSS', motivation: 'I want to gain practical experience with real projects and feedback.' };

describe('Internship applications', () => {
  let program;
  let admin;
  before(async () => {
    await resetDatabase();
    program = await createProgram();
    admin = await agentFor(await createUser('admin'));
  });
  after(closeDb);

  it('accepts a valid application as Pending, using the account email', async () => {
    const student = await createUser('student');
    const a = await agentFor(student);
    const res = await a.post(`/api/internships/${program.id}/applications`).send({ ...validApplication, email: 'spoof@example.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'pending');
    assert.equal(res.body.data.email, student.email);
    assert.equal(res.body.data.internalNotes, undefined);
  });

  it('rejects invalid applications', async () => {
    const a = await agentFor(await createUser('student'));
    const res = await a.post(`/api/internships/${program.id}/applications`).send({ fullName: '', motivation: 'too short', portfolioUrl: 'ftp://x' });
    assert.equal(res.status, 422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.ok(fields.includes('fullName') && fields.includes('motivation') && fields.includes('portfolioUrl'));
  });

  it('prevents duplicate active applications', async () => {
    const a = await agentFor(await createUser('student'));
    assert.equal((await a.post(`/api/internships/${program.id}/applications`).send(validApplication)).status, 201);
    const dup = await a.post(`/api/internships/${program.id}/applications`).send(validApplication);
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'DUPLICATE_APPLICATION');
  });

  it('rejects applications outside the application window', async () => {
    const closed = await createProgram({ applicationCloseAt: new Date(Date.now() - 1000), applicationOpenAt: new Date(Date.now() - 86400000) });
    const a = await agentFor(await createUser('student'));
    const res = await a.post(`/api/internships/${closed.id}/applications`).send(validApplication);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'APPLICATIONS_CLOSED');
  });

  it('approves an application and creates exactly one enrollment, transactionally', async () => {
    const student = await createUser('student');
    const s = await agentFor(student);
    const app = (await s.post(`/api/internships/${program.id}/applications`).send(validApplication)).body.data;
    const res = await admin.post(`/api/admin/internship-applications/${app.id}/decision`).send({ status: 'approved', internalNotes: 'Strong motivation' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.enrollment.status, 'in_progress', 'program already started');
    const again = await admin.post(`/api/admin/internship-applications/${app.id}/decision`).send({ status: 'approved' });
    assert.equal(again.status, 400, 'approved is a final state');
    assert.equal(await InternshipEnrollment.count({ where: { userId: student.id, programId: program.id } }), 1);
    assert.ok(await AuditLog.findOne({ where: { action: 'application.approved', entityId: app.id } }));
    const mine = await s.get('/api/student/internship/applications');
    assert.equal(mine.body.data[0].internalNotes, undefined, 'internal notes stay private');
    const dash = await s.get('/api/student/internship');
    assert.equal(dash.body.data.enrollment.program.id, program.id);
  });

  it('rejects an application with feedback and blocks invalid transitions', async () => {
    const s = await agentFor(await createUser('student'));
    const app = (await s.post(`/api/internships/${program.id}/applications`).send(validApplication)).body.data;
    const res = await admin.post(`/api/admin/internship-applications/${app.id}/decision`).send({ status: 'rejected', publicFeedback: 'Please gain basic HTML skills first.' });
    assert.equal(res.status, 200);
    const back = await admin.post(`/api/admin/internship-applications/${app.id}/decision`).send({ status: 'approved' });
    assert.equal(back.status, 400);
    assert.equal(back.body.error.code, 'INVALID_TRANSITION');
    const mine = await s.get('/api/student/internship/applications');
    assert.equal(mine.body.data[0].publicFeedback, 'Please gain basic HTML skills first.');
  });

  it('enforces capacity when approving', async () => {
    const small = await createProgram({ capacity: 1 });
    const apps = [];
    for (let i = 0; i < 2; i += 1) {
      const s = await agentFor(await createUser('student'));
      apps.push((await s.post(`/api/internships/${small.id}/applications`).send(validApplication)).body.data);
    }
    assert.equal((await admin.post(`/api/admin/internship-applications/${apps[0].id}/decision`).send({ status: 'approved' })).status, 200);
    const full = await admin.post(`/api/admin/internship-applications/${apps[1].id}/decision`).send({ status: 'approved' });
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'AT_CAPACITY');
    assert.equal((await admin.post(`/api/admin/internship-applications/${apps[1].id}/decision`).send({ status: 'waitlisted' })).status, 200);
  });

  it('restricts application access to admins', async () => {
    const student = await agentFor(await createUser('student'));
    const reviewer = await agentFor(await createUser('reviewer'));
    const app = await InternshipApplication.findOne();
    assert.equal((await student.get('/api/admin/internship-applications')).status, 403);
    assert.equal((await reviewer.get(`/api/admin/internship-applications/${app.id}`)).status, 403);
    assert.equal((await student.post(`/api/admin/internship-applications/${app.id}/decision`).send({ status: 'approved' })).status, 403);
  });

  it('only students can apply, and staff cannot self-enroll', async () => {
    const reviewer = await agentFor(await createUser('reviewer'));
    assert.equal((await reviewer.post(`/api/internships/${program.id}/applications`).send(validApplication)).status, 403);
  });
});
