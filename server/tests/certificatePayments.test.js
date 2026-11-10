import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetDatabase,
  createUser,
  agentFor,
  createCourse,
  createProgram,
  createTask,
  enroll,
  addAssessed,
  closeDb,
  isoDay,
  PNG_BYTES,
} from './helpers.js';
import { evaluateEnrollment, verifyCertificate } from '../src/services/internship/certificateService.js';

describe('Certificate payment receipts', () => {
  before(resetDatabase);
  after(closeDb);

  it('keeps course certificates locked until an admin approves a private receipt', async () => {
    const { course, lessons } = await createCourse({ lessons: 1, preview: 1 });
    await course.update({ curriculumLocked: true, certificateFee: 1200 });
    const student = await createUser('student');
    const admin = await agentFor(await createUser('admin'));
    const studentAgent = await agentFor(student);
    await studentAgent.post(`/api/courses/${course.id}/enroll`);
    await studentAgent.post(`/api/lessons/${lessons[0].id}/complete`).send({ completed: true });

    const items = (await studentAgent.get('/api/student/courses')).body.data;
    const item = items.find((entry) => entry.course.id === course.id);
    assert.equal(item.certificatePayment.required, true);
    assert.equal(item.certificatePayment.amount, 1200);
    assert.equal(item.certificatePayment.currency, 'PKR');
    assert.equal(item.certificate.recipientName, student.name);
    assert.ok(item.certificate.completionDate);
    assert.ok(item.certificate.issuedAt);
    assert.equal((await studentAgent.get(`/api/student/courses/${course.id}/certificate/download`)).status, 403);

    const settings = await admin.put('/api/admin/settings').send({
      certificatePayments: { bankName: 'Test Bank', accountHolder: 'Global360', accountNumber: 'TEST-IBAN' },
    });
    assert.equal(settings.status, 200);
    const refreshed = (await studentAgent.get('/api/student/courses')).body.data.find((entry) => entry.course.id === course.id);
    assert.equal(refreshed.certificatePayment.instructions.accountNumber, 'TEST-IBAN');
    const publicSettings = await studentAgent.get('/api/settings');
    assert.equal(publicSettings.body.data.certificatePayments, undefined, 'bank instructions are not exposed by the public settings endpoint');

    const certificateId = item.certificate.id;
    const outsider = await agentFor(await createUser('student'));
    const wrongOwnerUpload = await outsider
      .post(`/api/student/certificate-payments/course/${certificateId}/receipt`)
      .attach('receipt', PNG_BYTES, { filename: 'receipt.png', contentType: 'image/png' });
    assert.equal(wrongOwnerUpload.status, 404);

    const submission = await studentAgent
      .post(`/api/student/certificate-payments/course/${certificateId}/receipt`)
      .attach('receipt', PNG_BYTES, { filename: 'receipt.png', contentType: 'image/png' });
    assert.equal(submission.status, 201);
    assert.equal(submission.body.data.status, 'pending');
    assert.equal((await studentAgent.get(`/api/student/courses/${course.id}/certificate/download`)).status, 403);
    const hiddenVerification = await studentAgent.get(`/api/certificates/verify/${item.certificate.certificateNumber}`);
    assert.equal(hiddenVerification.body.data.status, 'not_found', 'unapproved paid certificates must not be publicly verifiable');
    const adminNotifications = (await admin.get('/api/notifications')).body.data;
    const receiptNotification = adminNotifications.find((notification) => notification.resourceId === submission.body.data.id);
    assert.equal(receiptNotification.type, 'certificate_payment_submitted');
    assert.equal(receiptNotification.title, 'Certificate payment receipt received');
    assert.equal(receiptNotification.link, '/admin/certificates');

    await course.update({ certificateFee: 1600 });
    const list = await admin.get('/api/admin/certificate-payments?status=pending');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].user.id, student.id);
    assert.equal(list.body.data[0].feeAmount, 1200);
    const paymentAfterFeeChange = (await studentAgent.get('/api/student/courses')).body.data.find((entry) => entry.course.id === course.id);
    assert.equal(paymentAfterFeeChange.certificatePayment.amount, 1200);
    const receipt = await admin.get(list.body.data[0].receiptUrl);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.headers['content-type'], 'image/png');

    const rejected = await admin
      .post(`/api/admin/certificate-payments/${submission.body.data.id}/review`)
      .send({ decision: 'reject', note: 'Receipt details are unreadable.' });
    assert.equal(rejected.status, 200);
    const rejectedItem = (await studentAgent.get('/api/student/courses')).body.data.find((entry) => entry.course.id === course.id);
    assert.equal(rejectedItem.certificatePayment.status, 'rejected');
    assert.equal(rejectedItem.certificatePayment.reviewNote, 'Receipt details are unreadable.');

    const resubmission = await studentAgent
      .post(`/api/student/certificate-payments/course/${certificateId}/receipt`)
      .attach('receipt', PNG_BYTES, { filename: 'corrected.png', contentType: 'image/png' });
    assert.equal(resubmission.status, 201);
    assert.equal(resubmission.body.data.status, 'pending');
    const resubmittedList = await admin.get('/api/admin/certificate-payments?status=pending');
    assert.equal(resubmittedList.body.data[0].feeAmount, 1600);
    assert.equal((await admin.post(`/api/admin/certificate-payments/${resubmission.body.data.id}/review`).send({ decision: 'approve' })).status, 200);
    assert.equal((await studentAgent.get(`/api/student/courses/${course.id}/certificate/download`)).status, 200);
    const verifiedCourse = await studentAgent.get(`/api/certificates/verify/${item.certificate.certificateNumber}`);
    assert.equal(verifiedCourse.body.data.valid, true);
    assert.equal(verifiedCourse.body.data.certificateType, 'course');
    assert.equal(verifiedCourse.body.data.courseTitle, course.title);
  });

  it('requires payment approval before an internship certificate can be downloaded or verified', async () => {
    const reviewer = await createUser('reviewer');
    const student = await createUser('student');
    const program = await createProgram({ startDate: isoDay(-90), endDate: isoDay(-5), certificateFee: 850 });
    const task = await createTask(program, {
      availableAt: new Date(Date.now() - 80 * 86400000),
      dueAt: new Date(Date.now() - 79 * 86400000),
    });
    const enrollment = await enroll(student, program);
    await addAssessed(task, enrollment, reviewer, { marks: 10 });
    const { certificate } = await evaluateEnrollment(enrollment.id);
    assert.ok(certificate);

    const studentAgent = await agentFor(student);
    const info = await studentAgent.get('/api/student/internship/certificate');
    assert.equal(info.body.data.certificatePayment.amount, 850);
    assert.equal(info.body.data.certificatePayment.required, true);
    assert.equal((await studentAgent.get('/api/student/internship/certificate/download')).status, 403);
    assert.equal((await verifyCertificate(certificate.certificateNumber)).status, 'not_found');

    const submission = await studentAgent
      .post(`/api/student/certificate-payments/internship/${certificate.id}/receipt`)
      .attach('receipt', PNG_BYTES, { filename: 'internship-receipt.png', contentType: 'image/png' });
    assert.equal(submission.status, 201);

    const admin = await agentFor(await createUser('admin'));
    assert.equal((await admin.post(`/api/admin/certificate-payments/${submission.body.data.id}/review`).send({ decision: 'approve' })).status, 200);
    assert.equal((await studentAgent.get('/api/student/internship/certificate/download')).status, 200);
    assert.equal((await verifyCertificate(certificate.certificateNumber)).status, 'valid');
  });
});
