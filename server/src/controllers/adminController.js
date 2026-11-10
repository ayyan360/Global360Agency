import { ok, created, noContent, clientIp } from '../utils/http.js';
import * as admin from '../services/adminService.js';
import * as programs from '../services/internship/programService.js';
import * as applications from '../services/internship/applicationService.js';
import * as tasks from '../services/internship/taskService.js';
import * as participants from '../services/internship/participantService.js';
import * as reviews from '../services/internship/reviewService.js';
import * as certificates from '../services/internship/certificateService.js';
import { updateSetting, getPublicSettings, getSetting } from '../services/settingsService.js';
import { audit } from '../services/auditService.js';
import { InternshipCertificate } from '../models/index.js';
import { notFound } from '../utils/errors.js';
import { certificateFilename } from '../utils/certificateFilename.js';
import * as certificatePayments from '../services/certificatePaymentService.js';

const ctx = (req) => ({ ip: clientIp(req) });
const list = (res, { items, meta }) => ok(res, items, meta);

// ----- Dashboard -----
export const dashboard = async (_req, res) => ok(res, await admin.dashboardStats());

// ----- Users -----
export const listUsers = async (req, res) => list(res, await admin.listUsers(req.valid.query));
export const getUser = async (req, res) => ok(res, await admin.getUserDetail(req.params.id));
export const updateUser = async (req, res) => ok(res, await admin.updateUserAdmin(req.user, req.params.id, req.valid.body, ctx(req)));
export const createUser = async (req, res) => created(res, await admin.createStaffUser(req.user, req.valid.body, ctx(req)));
export const instructors = async (_req, res) => ok(res, await admin.listInstructors());
export const reviewers = async (_req, res) => ok(res, await admin.listReviewers());

// ----- Courses / modules / lessons -----
export const listCourses = async (req, res) => list(res, await admin.adminListCourses(req.user, req.valid.query));
export const getCourse = async (req, res) => ok(res, await admin.adminGetCourse(req.user, req.params.id));
export const createCourse = async (req, res) => created(res, await admin.createCourse(req.user, req.valid.body, ctx(req)));
export const updateCourse = async (req, res) => ok(res, await admin.updateCourse(req.user, req.params.id, req.valid.body, ctx(req)));
export async function deleteCourse(req, res) {
  await admin.deleteCourse(req.user, req.params.id, ctx(req));
  noContent(res);
}
export const courseEnrollments = async (req, res) => list(res, await admin.courseEnrollments(req.user, req.params.id, req.valid.query));
export const lockCourseCurriculum = async (req, res) => ok(res, await admin.lockCourseCurriculum(req.user, req.params.id, ctx(req)));
export const completeCourseEnrollment = async (req, res) => ok(res, await admin.completeCourseEnrollment(req.user, req.params.id, req.params.enrollmentId, ctx(req)));
export const allEnrollments = async (req, res) => list(res, await admin.listAllEnrollments(req.valid.query));
export const createModule = async (req, res) => created(res, await admin.createModule(req.user, req.params.id, req.valid.body));
export const updateModule = async (req, res) => ok(res, await admin.updateModule(req.user, req.params.id, req.valid.body));
export async function deleteModule(req, res) {
  await admin.deleteModule(req.user, req.params.id);
  noContent(res);
}
export async function reorderModules(req, res) {
  await admin.reorderModules(req.user, req.params.id, req.valid.body.orderedIds);
  noContent(res);
}
export const createLesson = async (req, res) => created(res, await admin.createLesson(req.user, req.params.id, req.valid.body));
export const updateLesson = async (req, res) => ok(res, await admin.updateLesson(req.user, req.params.id, req.valid.body));
export async function deleteLesson(req, res) {
  await admin.deleteLesson(req.user, req.params.id);
  noContent(res);
}
export async function reorderLessons(req, res) {
  await admin.reorderLessons(req.user, req.params.id, req.valid.body.orderedIds);
  noContent(res);
}

// ----- Internship programs -----
export const listPrograms = async (req, res) => list(res, await programs.adminListPrograms(req.valid.query));
export const getProgram = async (req, res) => ok(res, await programs.adminGetProgram(req.params.id));
export const createProgram = async (req, res) => created(res, await programs.createProgram(req.user, req.valid.body, ctx(req)));
export const updateProgram = async (req, res) => ok(res, await programs.updateProgram(req.user, req.params.id, req.valid.body, ctx(req)));
export async function deleteProgram(req, res) {
  await programs.deleteProgram(req.user, req.params.id, ctx(req));
  noContent(res);
}
export const addHoliday = async (req, res) => created(res, await programs.addHoliday(req.user, req.params.id, req.valid.body, ctx(req)));
export async function removeHoliday(req, res) {
  await programs.removeHoliday(req.user, req.params.id, req.params.holidayId, ctx(req));
  noContent(res);
}
export const assignReviewer = async (req, res) => created(res, await programs.assignReviewer(req.user, req.params.id, req.valid.body, ctx(req)));
export async function removeReviewer(req, res) {
  await programs.removeReviewer(req.user, req.params.id, req.params.assignmentId, ctx(req));
  noContent(res);
}
export const programReport = async (req, res) => ok(res, await participants.programReport(req.params.id));
export async function participantsCsv(req, res) {
  const { filename, csv } = await participants.participantsCsv(req.params.id);
  await audit({ actorId: req.user.id, action: 'report.exported', entityType: 'InternshipProgram', entityId: req.params.id, metadata: { type: 'participants_csv' }, ip: clientIp(req) });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
}
export async function evaluateProgram(req, res) {
  ok(res, await certificates.evaluateEndedEnrollments({ programId: req.params.id }));
}

// ----- Applications -----
export const listApplications = async (req, res) => list(res, await applications.adminListApplications(req.valid.query));
export const getApplication = async (req, res) => ok(res, await applications.adminGetApplication(req.params.id));
export const decideApplication = async (req, res) => ok(res, await applications.decideApplication(req.user, req.params.id, req.valid.body, ctx(req)));

// ----- Enrollments -----
export const listEnrollments = async (req, res) => list(res, await participants.adminListEnrollments(req.valid.query));
export const getEnrollment = async (req, res) => ok(res, await participants.adminGetEnrollment(req.params.id));
export const setEnrollmentStatus = async (req, res) => ok(res, await participants.adminSetEnrollmentStatus(req.user, req.params.id, req.valid.body, ctx(req)));
export async function evaluateEnrollment(req, res) {
  const { results, certificate, issued, warning } = await participants.adminEvaluateEnrollment(req.user, req.params.id, ctx(req));
  ok(res, { results, certificate, issued, warning });
}

// ----- Tasks -----
export const listTasks = async (req, res) => list(res, await tasks.adminListTasks(req.valid.query));
export const getTask = async (req, res) => ok(res, await tasks.adminGetTask(req.params.id));
export const createTask = async (req, res) => created(res, await tasks.createTask(req.user, req.params.id, req.valid.body, ctx(req)));
export const updateTask = async (req, res) => ok(res, await tasks.updateTask(req.user, req.params.id, req.valid.body, ctx(req)));
export const setTaskStatus = async (req, res) => ok(res, await tasks.setTaskStatus(req.user, req.params.id, req.valid.body.status, ctx(req)));
export async function deleteTask(req, res) {
  await tasks.deleteTask(req.user, req.params.id, ctx(req));
  noContent(res);
}
export const generateTasks = async (req, res) => created(res, await tasks.generateTasksFromPlan(req.user, req.params.id, req.valid.body.plan, { publish: req.valid.body.publish, ip: clientIp(req) }));
export const previewTimes = async (req, res) => ok(res, await programs.previewTaskTimes(req.params.id, req.query.date));

// ----- Reviews (reviewers + admins) -----
export const reviewQueue = async (req, res) => list(res, await reviews.reviewQueue(req.user, req.valid.query));
export const reviewPrograms = async (req, res) => ok(res, await reviews.reviewerPrograms(req.user));
export const getSubmission = async (req, res) => ok(res, await reviews.getSubmissionForReview(req.user, req.params.id));
export const startReview = async (req, res) => ok(res, await reviews.startReview(req.user, req.params.id));
export const assess = async (req, res) => created(res, await reviews.assessSubmission(req.user, req.params.id, req.valid.body, ctx(req)));
export const amend = async (req, res) => created(res, await reviews.amendAssessment(req.user, req.params.id, req.valid.body, ctx(req)));

// ----- Certificates -----
export const listCertificates = async (req, res) => list(res, await admin.listCertificates(req.valid.query));
export const revokeCertificate = async (req, res) => ok(res, await certificates.revokeCertificate(req.user, req.params.id, req.valid.body.reason, ctx(req)));
export async function downloadCertificate(req, res) {
  const cert = await InternshipCertificate.findByPk(req.params.id);
  if (!cert) throw notFound('Certificate not found.');
  const pdf = await certificates.ensureCertificatePdf(cert);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${certificateFilename('Internship', cert.programTitle)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}
export const listCertificatePayments = async (req, res) => list(res, await certificatePayments.listPaymentRequests(req.valid.query));
export async function downloadCertificatePaymentReceipt(req, res) {
  const receipt = await certificatePayments.getPaymentReceiptForAdmin(req.params.id);
  res.setHeader('Content-Type', receipt.mimeType);
  res.setHeader('Content-Length', String(receipt.sizeBytes));
  res.setHeader('Content-Disposition', 'inline; filename="payment-receipt"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  receipt.stream.pipe(res);
}
export async function reviewCertificatePayment(req, res) {
  ok(res, await certificatePayments.reviewPaymentRequest(req.user, req.params.id, req.valid.body, ctx(req)));
}

// ----- Messages, audit, settings -----
export const listMessages = async (req, res) => list(res, await admin.listMessages(req.valid.query));
export const updateMessage = async (req, res) => ok(res, await admin.updateMessageStatus(req.params.id, req.valid.body.status));
export const auditLogs = async (req, res) => list(res, await admin.listAuditLogs(req.valid.query));
export async function getSettings(_req, res) {
  ok(res, { ...await getPublicSettings(), certificatePayments: await getSetting('certificatePayments') });
}
export async function updateSettings(req, res) {
  for (const [key, value] of Object.entries(req.valid.body)) {
    if (value) await updateSetting(key, value, req.user.id);
  }
  await audit({ actorId: req.user.id, action: 'settings.updated', entityType: 'SiteSetting', metadata: { keys: Object.keys(req.valid.body) }, ip: clientIp(req) });
  ok(res, { ...await getPublicSettings(), certificatePayments: await getSetting('certificatePayments') });
}
