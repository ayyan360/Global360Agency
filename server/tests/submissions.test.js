import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabase, createUser, agentFor, createProgram, createTask, enroll, assignReviewer, closeDb, PNG_BYTES, PDF_BYTES } from './helpers.js';
import { TaskSubmission, TaskAssessment, TaskReviewHistory, SubmissionAttachment } from '../src/models/index.js';

describe('Submissions and reviews', () => {
  let program;
  let otherProgram;
  let task;
  let student;
  let s;
  let reviewer;
  let r;
  let enrollment;
  before(async () => {
    await resetDatabase();
    program = await createProgram();
    otherProgram = await createProgram();
    task = await createTask(program, { maxMarks: 20 });
    student = await createUser('student');
    enrollment = await enroll(student, program);
    s = await agentFor(student);
    reviewer = await createUser('reviewer');
    await assignReviewer(reviewer, program);
    r = await agentFor(reviewer);
  });
  after(closeDb);

  it('accepts a valid submission with a real file and records metadata', async () => {
    const res = await s
      .post(`/api/student/internship/tasks/${task.id}/submissions`)
      .field('submissionText', 'My work explanation')
      .field('repositoryUrl', 'https://github.com/example/repo')
      .attach('files', PNG_BYTES, { filename: 'screenshot.png', contentType: 'image/png' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.submission.version, 1);
    assert.equal(res.body.data.submission.status, 'submitted');
    const att = await SubmissionAttachment.findOne();
    assert.equal(att.mimeType, 'image/png');
    assert.ok(!att.storageKey.includes('screenshot'), 'storage key is not derived from the user file name');
  });

  it('rejects files whose content does not match their extension', async () => {
    const res = await s
      .post(`/api/student/internship/tasks/${task.id}/submissions`)
      .field('submissionText', 'Trying a fake file')
      .attach('files', Buffer.from('#!/bin/sh\nrm -rf /\n'), { filename: 'evil.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 422);
  });

  it('rejects disallowed file types and invalid URLs', async () => {
    const exe = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).attach('files', Buffer.from('MZ....'), { filename: 'tool.exe' });
    assert.equal(exe.status, 422);
    const badUrl = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).field('repositoryUrl', 'javascript:alert(1)');
    assert.equal(badUrl.status, 422);
    const empty = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).field('submissionText', '');
    assert.equal(empty.status, 422);
  });

  it('a resubmission before review supersedes the earlier version without deleting it', async () => {
    const res = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).field('submissionText', 'Improved version').attach('files', PDF_BYTES, { filename: 'report.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.submission.version, 2);
    const versions = await TaskSubmission.findAll({ where: { taskId: task.id }, order: [['version', 'ASC']] });
    assert.deepEqual(versions.map((v) => v.status), ['superseded', 'submitted']);
    const history = await s.get(`/api/student/internship/tasks/${task.id}/submissions`);
    assert.equal(history.body.data.length, 2);
  });

  it('prevents other students from reading submissions or private attachments', async () => {
    const other = await agentFor(await createUser('student'));
    const att = await SubmissionAttachment.findOne();
    assert.equal((await other.get(`/api/attachments/${att.id}`)).status, 404);
    assert.equal((await other.get(`/api/student/internship/tasks/${task.id}/submissions`)).status, 404, 'not enrolled');
    const own = await s.get(`/api/attachments/${att.id}`);
    assert.equal(own.status, 200);
    assert.equal(own.headers['x-content-type-options'], 'nosniff');
    assert.match(own.headers['content-disposition'], /^attachment/);
  });

  it('blocks reviewers who are not assigned to the program', async () => {
    const outsider = await createUser('reviewer');
    await assignReviewer(outsider, otherProgram);
    const o = await agentFor(outsider);
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, status: 'submitted' } });
    assert.equal((await o.get(`/api/admin/internship-submissions/${latest.id}`)).status, 403);
    assert.equal((await o.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'approve', marksAwarded: 10, feedback: 'Looks good to me' })).status, 403);
    const queue = await o.get('/api/admin/internship-submissions');
    assert.equal(queue.body.data.length, 0, 'unassigned reviewers see nothing in their queue');
  });

  it('validates the marks range and requires marks for final decisions', async () => {
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, status: 'submitted' } });
    const tooHigh = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'approve', marksAwarded: 21, feedback: 'Great work overall' });
    assert.equal(tooHigh.status, 422);
    const negative = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'approve', marksAwarded: -1, feedback: 'Great work overall' });
    assert.equal(negative.status, 422);
    const noMarks = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'reject', feedback: 'Not acceptable work' });
    assert.equal(noMarks.status, 422);
  });

  it('requests a revision, then the student resubmits a new version', async () => {
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, status: 'submitted' } });
    const rev = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'request_revision', feedback: 'Please add tests and a README.' });
    assert.equal(rev.status, 201);
    await latest.reload();
    assert.equal(latest.status, 'revision_required');
    const v3 = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).field('submissionText', 'Added tests and README');
    assert.equal(v3.status, 201);
    assert.equal(v3.body.data.submission.version, 3);
  });

  it('persists feedback, finalizes an approval and refuses to overwrite it', async () => {
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, version: 3 } });
    const ok = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'approve', marksAwarded: 18, feedback: 'Excellent improvements.' });
    assert.equal(ok.status, 201);
    const again = await r.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'reject', marksAwarded: 0, feedback: 'Changed my mind' });
    assert.equal(again.status, 409, 'finalized assessments are not silently overwritten');
    const a = await TaskAssessment.findOne({ where: { submissionId: latest.id, isFinal: true } });
    assert.equal(a.marksAwarded, 18);
    assert.equal(a.reviewerId, reviewer.id);
    const hist = await TaskReviewHistory.count({ where: { submissionId: latest.id } });
    assert.ok(hist >= 2);
    const studentView = await s.get(`/api/student/internship/tasks/${task.id}/submissions`);
    assert.equal(studentView.body.data[0].assessments[0].feedback, 'Excellent improvements.');
    const blocked = await s.post(`/api/student/internship/tasks/${task.id}/submissions`).field('submissionText', 'One more');
    assert.equal(blocked.status, 409, 'no resubmission after a finalized assessment');
  });

  it('students cannot assess or change marks', async () => {
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, version: 3 } });
    assert.equal((await s.post(`/api/admin/internship-submissions/${latest.id}/assessments`).send({ decision: 'approve', marksAwarded: 20, feedback: 'I approve myself' })).status, 403);
    const a = await TaskAssessment.findOne({ where: { submissionId: latest.id, isFinal: true } });
    assert.equal((await s.post(`/api/admin/internship-assessments/${a.id}/amend`).send({ decision: 'approve', marksAwarded: 20, feedback: 'x', reason: 'because' })).status, 403);
    assert.equal((await r.post(`/api/admin/internship-assessments/${a.id}/amend`).send({ decision: 'approve', marksAwarded: 20, feedback: 'Amended feedback', reason: 'Reviewer wants to amend' })).status, 403, 'only admins amend');
  });

  it('admins can amend a finalized assessment with an audited reason, preserving the original', async () => {
    const admin = await agentFor(await createUser('admin'));
    const latest = await TaskSubmission.findOne({ where: { taskId: task.id, version: 3 } });
    const a = await TaskAssessment.findOne({ where: { submissionId: latest.id, isFinal: true } });
    const res = await admin.post(`/api/admin/internship-assessments/${a.id}/amend`).send({ decision: 'approve', marksAwarded: 19, feedback: 'Corrected marks', reason: 'Arithmetic error in rubric' });
    assert.equal(res.status, 201);
    await a.reload();
    assert.ok(a.supersededAt);
    const current = await TaskAssessment.findAll({ where: { submissionId: latest.id, isFinal: true, supersededAt: null } });
    assert.equal(current.length, 1);
    assert.equal(current[0].marksAwarded, 19);
  });

  it('does not accept submissions for tasks that have not been released', async () => {
    const future = await createTask(program, { availableAt: new Date(Date.now() + 86400000) });
    assert.equal((await s.get(`/api/student/internship/tasks/${future.id}`)).status, 403);
    const res = await s.post(`/api/student/internship/tasks/${future.id}/submissions`).field('submissionText', 'Too early');
    assert.equal(res.status, 409);
  });

  it('flags late submissions when the late policy accepts them, and rejects them when it does not', async () => {
    const late = await createTask(program, { availableAt: new Date(Date.now() - 3 * 86400000), dueAt: new Date(Date.now() - 2 * 86400000) });
    const res = await s.post(`/api/student/internship/tasks/${late.id}/submissions`).field('submissionText', 'Late work');
    assert.equal(res.status, 201);
    assert.equal(res.body.data.submission.isLate, true);
    await program.update({ scheduleConfig: { lateSubmissionPolicy: 'reject' } });
    const late2 = await createTask(program, { availableAt: new Date(Date.now() - 3 * 86400000), dueAt: new Date(Date.now() - 2 * 86400000) });
    const rejected = await s.post(`/api/student/internship/tasks/${late2.id}/submissions`).field('submissionText', 'Late work');
    assert.equal(rejected.status, 409);
    await program.update({ scheduleConfig: {} });
  });

  it('withdrawn participants cannot submit', async () => {
    const t = await createTask(program);
    await enrollment.update({ status: 'withdrawn' });
    const res = await s.post(`/api/student/internship/tasks/${t.id}/submissions`).field('submissionText', 'Work');
    assert.equal(res.status, 409);
    await enrollment.update({ status: 'in_progress' });
  });
});
