import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, resetDatabase, createUser, agentFor, createProgram, createTask, enroll, addAssessed, closeDb, isoDay } from './helpers.js';
import { InternshipCertificate, InternshipEnrollment, AuditLog } from '../src/models/index.js';
import { evaluateEnrollment } from '../src/services/internship/certificateService.js';

/** An ended program with N required tasks of 10 marks each. */
async function endedProgramWithTasks(n = 5, overrides = {}) {
  const program = await createProgram({ startDate: isoDay(-90), endDate: isoDay(-5), ...overrides });
  const tasks = [];
  for (let i = 0; i < n; i += 1) {
    const availableAt = new Date(Date.now() - (80 - i) * 86400000);
    tasks.push(await createTask(program, { availableAt, dueAt: new Date(availableAt.getTime() + 86400000), maxMarks: 10 }));
  }
  return { program, tasks };
}

async function participantWithMarks(program, tasks, marks, reviewer) {
  const user = await createUser('student');
  const enrollment = await enroll(user, program);
  for (const [i, m] of marks.entries()) {
    if (m === null) continue; // not submitted
    if (m === 'pending') await addAssessed(tasks[i], enrollment, reviewer, { decision: null });
    else await addAssessed(tasks[i], enrollment, reviewer, { marks: m });
  }
  return { user, enrollment };
}

describe('Certificate eligibility, issuance and verification', () => {
  let reviewer;
  before(async () => {
    await resetDatabase();
    reviewer = await createUser('reviewer');
  });
  after(closeDb);

  it('issues a certificate at exactly 70% when all checks pass', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [7, 7, 7, 7, 7], reviewer);
    const { results, certificate, issued } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.finalScore, 70);
    assert.equal(results.outcome, 'qualified');
    assert.equal(issued, true);
    assert.match(certificate.certificateNumber, /^G360-\d{4}-[A-Z0-9]{8}$/);
    await enrollment.reload();
    assert.equal(enrollment.status, 'completed_qualified');
    assert.ok(await AuditLog.findOne({ where: { action: 'certificate.issued', entityId: certificate.id } }));
  });

  it('issues a certificate above 70%', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [9, 10, 8, 9, 10], reviewer);
    const { results, issued } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.outcome, 'qualified');
    assert.equal(issued, true);
  });

  it('marks participants below 70% as Completed — Not Qualified without a certificate', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [6, 7, 7, 7, 7], reviewer);
    const { results, certificate } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.finalScore, 68);
    assert.equal(certificate, null);
    await enrollment.reload();
    assert.equal(enrollment.status, 'completed_not_qualified');
    assert.equal(await InternshipCertificate.count({ where: { enrollmentId: enrollment.id } }), 0);
  });

  it('does not issue certificates before the program end date', async () => {
    const program = await createProgram({ startDate: isoDay(-30), endDate: isoDay(10) });
    const task = await createTask(program);
    const { enrollment } = await participantWithMarks(program, [task], [10], reviewer);
    const { results, certificate } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.outcome, 'in_progress');
    assert.equal(certificate, null);
    await enrollment.reload();
    assert.equal(enrollment.status, 'in_progress');
  });

  it('does not issue certificates when required tasks are incomplete', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [10, 10, 10, null, null], reviewer);
    const { results, certificate } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.completionProgress, 60);
    assert.equal(results.eligible, false);
    assert.equal(certificate, null);
  });

  it('does not finalize while required assessments are pending', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [10, 10, 10, 10, 'pending'], reviewer);
    const { results, certificate } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.outcome, 'awaiting_assessments');
    assert.equal(certificate, null);
    await enrollment.reload();
    assert.equal(enrollment.status, 'in_progress', 'not marked completed while assessments are unresolved');
  });

  it('does not issue certificates to withdrawn participants', async () => {
    const { program, tasks } = await endedProgramWithTasks(5);
    const { enrollment } = await participantWithMarks(program, tasks, [10, 10, 10, 10, 10], reviewer);
    await enrollment.update({ status: 'withdrawn' });
    const { results, certificate } = await evaluateEnrollment(enrollment.id);
    assert.equal(results.outcome, 'ineligible');
    assert.equal(certificate, null);
  });

  it('is idempotent: repeated and concurrent evaluations create a single certificate', async () => {
    const { program, tasks } = await endedProgramWithTasks(3);
    const { enrollment } = await participantWithMarks(program, tasks, [9, 9, 9], reviewer);
    await Promise.all([evaluateEnrollment(enrollment.id), evaluateEnrollment(enrollment.id), evaluateEnrollment(enrollment.id)]);
    await evaluateEnrollment(enrollment.id);
    assert.equal(await InternshipCertificate.count({ where: { enrollmentId: enrollment.id } }), 1);
    await assert.rejects(
      InternshipCertificate.create({ enrollmentId: enrollment.id, certificateNumber: 'G360-2026-DUPLICAT', recipientName: 'x', programTitle: 'x', track: 'x', startDate: program.startDate, endDate: program.endDate, completionDate: program.endDate, finalScore: 90 }),
      /SequelizeUniqueConstraintError|unique/i,
      'database constraint rejects a second certificate for the same enrollment'
    );
  });

  it('lets only the owner download the PDF', async () => {
    const { program, tasks } = await endedProgramWithTasks(2);
    const { user, enrollment } = await participantWithMarks(program, tasks, [10, 9], reviewer);
    await evaluateEnrollment(enrollment.id);
    const owner = await agentFor(user);
    const dl = await owner.get('/api/student/internship/certificate/download').buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(dl.status, 200);
    assert.equal(dl.headers['content-type'], 'application/pdf');
    assert.equal(dl.body.subarray(0, 4).toString(), '%PDF');
    const stranger = await agentFor(await createUser('student'));
    assert.equal((await stranger.get('/api/student/internship/certificate/download')).status, 404);
    assert.equal((await request(app).get('/api/student/internship/certificate/download')).status, 401);
    const cert = await InternshipCertificate.findOne({ where: { enrollmentId: enrollment.id } });
    assert.equal((await stranger.get(`/api/admin/internship-certificates/${cert.id}/download`)).status, 403);
  });

  it('public verification exposes only approved fields', async () => {
    const cert = await InternshipCertificate.findOne({ where: { status: 'valid' } });
    const res = await request(app).get(`/api/certificates/verify/${cert.certificateNumber}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, true);
    const keys = Object.keys(res.body.data).sort();
    assert.deepEqual(keys, ['certificateNumber', 'certificateType', 'completionDate', 'endDate', 'holderName', 'issuedAt', 'programTitle', 'startDate', 'status', 'track', 'valid'].sort());
    const body = JSON.stringify(res.body);
    assert.ok(!body.includes('@'), 'no email addresses');
    assert.ok(!body.includes('finalScore') && !body.includes('enrollmentId'));
    const unknown = await request(app).get('/api/certificates/verify/G360-2026-ZZZZZZZZ');
    assert.equal(unknown.body.data.valid, false);
    assert.equal(unknown.body.data.status, 'not_found');
  });

  it('revoked certificates verify as invalid and revocation is audited', async () => {
    const cert = await InternshipCertificate.findOne({ where: { status: 'valid' } });
    const admin = await agentFor(await createUser('admin'));
    const noReason = await admin.post(`/api/admin/internship-certificates/${cert.id}/revoke`).send({ reason: '' });
    assert.equal(noReason.status, 422);
    const res = await admin.post(`/api/admin/internship-certificates/${cert.id}/revoke`).send({ reason: 'Issued in error after plagiarism review' });
    assert.equal(res.status, 200);
    const v = await request(app).get(`/api/certificates/verify/${cert.certificateNumber}`);
    assert.equal(v.body.data.valid, false);
    assert.equal(v.body.data.status, 'revoked');
    assert.ok(await AuditLog.findOne({ where: { action: 'certificate.revoked', entityId: cert.id } }));
    const enrollment = await InternshipEnrollment.findByPk(cert.enrollmentId);
    const owner = await agentFor(await (await import('../src/models/index.js')).User.findByPk(enrollment.userId));
    assert.equal((await owner.get('/api/student/internship/certificate/download')).status, 403);
  });

  it('students and reviewers cannot issue or revoke certificates', async () => {
    const cert = await InternshipCertificate.findOne();
    const student = await agentFor(await createUser('student'));
    const rev = await agentFor(reviewer);
    assert.equal((await student.post(`/api/admin/internship-certificates/${cert.id}/revoke`).send({ reason: 'not allowed at all' })).status, 403);
    assert.equal((await rev.post(`/api/admin/internship-certificates/${cert.id}/revoke`).send({ reason: 'not allowed at all' })).status, 403);
    assert.equal((await student.post(`/api/admin/internship-enrollments/${cert.enrollmentId}/evaluate`)).status, 403);
  });
});
