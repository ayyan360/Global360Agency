import { ok, created } from '../utils/http.js';
import * as learning from '../services/learningService.js';
import { getCourseCertificatePdfForUser } from '../services/courseCertificateService.js';
import * as applications from '../services/internship/applicationService.js';
import * as tasks from '../services/internship/taskService.js';
import * as submissions from '../services/internship/submissionService.js';
import * as participant from '../services/internship/participantService.js';
import { getCertificatePdfForUser } from '../services/internship/certificateService.js';
import * as notifications from '../services/notificationService.js';
import { certificateFilename } from '../utils/certificateFilename.js';
import * as certificatePayments from '../services/certificatePaymentService.js';

// ----- Learning -----
export const dashboard = async (req, res) => ok(res, await learning.studentDashboard(req.user));
export const myCourses = async (req, res) => ok(res, await learning.studentCourses(req.user));
export const progress = async (req, res) => ok(res, await learning.studentProgress(req.user));
export const wishlist = async (req, res) => ok(res, await learning.listWishlist(req.user));

export async function enroll(req, res) {
  const { enrollment, course } = await learning.enrollInCourse(req.user, req.params.courseId);
  created(res, { enrollmentId: enrollment.id, courseId: course.id, slug: course.slug, status: enrollment.status });
}

export const getLesson = async (req, res) => ok(res, await learning.getLessonForViewer(req.user, req.params.lessonId));
export const completeLesson = async (req, res) => ok(res, await learning.setLessonCompletion(req.user, req.params.lessonId, req.valid.body?.completed ?? true));
export async function downloadCourseCertificate(req, res) {
  const { certificate, pdf } = await getCourseCertificatePdfForUser(req.user, req.params.courseId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${certificateFilename('Course', certificate.courseTitle)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}
export const review = async (req, res) => ok(res, await learning.upsertReview(req.user, req.params.courseId, req.valid.body));
export const toggleWishlist = async (req, res) => ok(res, await learning.toggleWishlist(req.user, req.params.courseId));

// ----- Internship -----
export async function apply(req, res) {
  const app = await applications.submitApplication(req.user, req.params.programId, req.valid.body);
  created(res, app.toApplicantJSON());
}
export const myApplications = async (req, res) => ok(res, await applications.listMyApplications(req.user));
export const withdrawApplication = async (req, res) => ok(res, await applications.withdrawApplication(req.user, req.params.id));

export const internshipDashboard = async (req, res) => ok(res, await participant.participantDashboard(req.user));
export const internshipTasks = async (req, res) => ok(res, await tasks.participantWeek(req.user, req.valid.query.week));
export const internshipTask = async (req, res) => ok(res, await tasks.participantTaskDetail(req.user, req.params.taskId));
export async function downloadTaskAttachment(req, res) {
  const { attachment, signedUrl, stream } = await tasks.getParticipantTaskPdf(req.user, req.params.taskId);
  if (signedUrl) return res.redirect(302, signedUrl);
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', String(attachment.sizeBytes));
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  stream.pipe(res);
}
export const internshipProgress = async (req, res) => ok(res, await participant.participantProgress(req.user));
export const internshipCertificate = async (req, res) => ok(res, await participant.participantCertificate(req.user));
export const withdrawInternship = async (req, res) => ok(res, await participant.participantWithdraw(req.user, req.valid.body?.reason));

export async function submitTask(req, res) {
  const result = await submissions.createSubmission(req.user, req.params.taskId, req.valid.body, req.files || []);
  created(res, result);
}
export const taskSubmissions = async (req, res) => ok(res, await submissions.getSubmissionHistoryForParticipant(req.user, req.params.taskId));

export async function downloadCertificate(req, res) {
  const { certificate, pdf } = await getCertificatePdfForUser(req.user);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${certificateFilename('Internship', certificate.programTitle)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}
export async function submitCertificatePaymentReceipt(req, res) {
  const result = await certificatePayments.submitPaymentReceipt(
    req.user,
    req.params.certificateType,
    req.params.certificateId,
    req.file
  );
  created(res, result);
}

// ----- Attachments (owner, assigned reviewer or admin) -----
export async function downloadAttachment(req, res) {
  const { attachment, signedUrl, stream } = await submissions.getAttachmentForUser(req.user, req.params.id);
  if (signedUrl) return res.redirect(302, signedUrl);
  const inline = req.query.inline === '1' && ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(attachment.mimeType);
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', String(attachment.sizeBytes));
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  stream.pipe(res);
}

// ----- Notifications -----
export async function listNotifications(req, res) {
  const { items, meta } = await notifications.listNotifications(req.user.id, req.valid.query);
  ok(res, items, { ...meta, unread: await notifications.unreadCount(req.user.id) });
}
export const unreadCount = async (req, res) => ok(res, { unread: await notifications.unreadCount(req.user.id) });
export const markRead = async (req, res) => ok(res, await notifications.markRead(req.user.id, req.params.id));
export const markAllRead = async (req, res) => ok(res, { updated: await notifications.markAllRead(req.user.id) });
