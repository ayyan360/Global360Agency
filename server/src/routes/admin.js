import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requirePermission } from '../middleware/auth.js';
import { taskPdfUpload } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimits.js';
import * as S from '../validators/schemas.js';
import { idParam, uuid, isoDate } from '../validators/common.js';
import { paginationQuery } from '../utils/pagination.js';
import * as A from '../controllers/adminController.js';

/**
 * /api/admin — every route declares the permission it needs. The admin UI hides sections a role
 * can't use, but authorization is always enforced here and in the services.
 */
const r = Router();
const perm = requirePermission;
const v = validate;
const pageOnly = z.object({ ...paginationQuery });

// Dashboard & reports
r.get('/dashboard', perm('reports:view'), A.dashboard);

// Users
r.get('/users', perm('users:manage'), v({ query: S.adminUserQuery }), A.listUsers);
r.post('/users', perm('roles:manage'), v({ body: S.adminCreateUserBody }), A.createUser);
r.get('/users/:id', perm('users:manage'), v({ params: idParam }), A.getUser);
r.patch('/users/:id', perm('users:manage'), v({ params: idParam, body: S.adminUserUpdateBody }), A.updateUser);
r.get('/instructors', perm('courses:manage'), A.instructors);
r.get('/reviewers', perm('internships:manage'), A.reviewers);

// Courses, modules, lessons (admins: all; instructors: their own courses)
const courseMgr = perm('courses:manage', 'courses:manage-own');
r.get('/courses', courseMgr, v({ query: S.adminCourseQuery }), A.listCourses);
r.post('/courses', courseMgr, v({ body: S.courseCreateBody }), A.createCourse);
r.get('/courses/:id', courseMgr, v({ params: idParam }), A.getCourse);
r.patch('/courses/:id', courseMgr, v({ params: idParam, body: S.courseUpdateBody }), A.updateCourse);
r.delete('/courses/:id', courseMgr, v({ params: idParam }), A.deleteCourse);
r.get('/courses/:id/enrollments', courseMgr, v({ params: idParam, query: pageOnly }), A.courseEnrollments);
r.post('/courses/:id/lock-curriculum', courseMgr, v({ params: idParam }), A.lockCourseCurriculum);
r.post('/courses/:id/enrollments/:enrollmentId/complete', courseMgr, v({ params: z.object({ id: uuid, enrollmentId: uuid }) }), A.completeCourseEnrollment);
r.post('/courses/:id/modules', courseMgr, v({ params: idParam, body: S.moduleBody }), A.createModule);
r.put('/courses/:id/modules/order', courseMgr, v({ params: idParam, body: S.reorderBody }), A.reorderModules);
r.patch('/modules/:id', courseMgr, v({ params: idParam, body: S.updateSchema(S.moduleBody) }), A.updateModule);
r.delete('/modules/:id', courseMgr, v({ params: idParam }), A.deleteModule);
r.post('/modules/:id/lessons', courseMgr, v({ params: idParam, body: S.lessonBody }), A.createLesson);
r.put('/modules/:id/lessons/order', courseMgr, v({ params: idParam, body: S.reorderBody }), A.reorderLessons);
r.patch('/lessons/:id', courseMgr, v({ params: idParam, body: S.updateSchema(S.lessonBody) }), A.updateLesson);
r.delete('/lessons/:id', courseMgr, v({ params: idParam }), A.deleteLesson);
r.get('/enrollments', perm('courses:manage'), v({ query: S.enrollmentListQuery }), A.allEnrollments);

// Internship programs
const im = perm('internships:manage');
r.get('/internships', im, v({ query: S.programListQuery }), A.listPrograms);
r.post('/internships', im, v({ body: S.programBody }), A.createProgram);
r.get('/internships/:id', im, v({ params: idParam }), A.getProgram);
r.patch('/internships/:id', im, v({ params: idParam, body: S.programUpdateBody }), A.updateProgram);
r.delete('/internships/:id', im, v({ params: idParam }), A.deleteProgram);
r.post('/internships/:id/holidays', im, v({ params: idParam, body: S.holidayBody }), A.addHoliday);
r.delete('/internships/:id/holidays/:holidayId', im, v({ params: z.object({ id: uuid, holidayId: uuid }) }), A.removeHoliday);
r.post('/internships/:id/reviewers', im, v({ params: idParam, body: S.reviewerAssignBody }), A.assignReviewer);
r.delete('/internships/:id/reviewers/:assignmentId', im, v({ params: z.object({ id: uuid, assignmentId: uuid }) }), A.removeReviewer);
r.post('/internships/:id/tasks', im, v({ params: idParam, body: S.taskCreateBody }), A.createTask);
r.post('/internships/:id/tasks/generate', im, v({ params: idParam, body: S.taskPlanBody }), A.generateTasks);
r.get('/internships/:id/task-times', im, v({ params: idParam, query: z.object({ date: isoDate }) }), A.previewTimes);
r.post('/internships/:id/evaluate', perm('certificates:manage'), v({ params: idParam }), A.evaluateProgram);
r.get('/internship-reports/:id', perm('reports:view'), v({ params: idParam }), A.programReport);
r.get('/internship-reports/:id/participants.csv', perm('reports:view'), v({ params: idParam }), A.participantsCsv);

// Applications
const am = perm('applications:manage');
r.get('/internship-applications', am, v({ query: S.applicationListQuery }), A.listApplications);
r.get('/internship-applications/:id', am, v({ params: idParam }), A.getApplication);
r.post('/internship-applications/:id/decision', am, v({ params: idParam, body: S.applicationDecisionBody }), A.decideApplication);

// Enrollments / participants
r.get('/internship-enrollments', im, v({ query: S.enrollmentAdminQuery }), A.listEnrollments);
r.get('/internship-enrollments/:id', im, v({ params: idParam }), A.getEnrollment);
r.post('/internship-enrollments/:id/status', im, v({ params: idParam, body: S.enrollmentStatusBody }), A.setEnrollmentStatus);
r.post('/internship-enrollments/:id/evaluate', perm('certificates:manage'), v({ params: idParam }), A.evaluateEnrollment);

// Tasks
r.get('/internship-tasks', im, v({ query: S.taskListQuery }), A.listTasks);
r.get('/internship-tasks/:id/attachment', im, v({ params: idParam }), A.downloadTaskAttachment);
r.post('/internship-tasks/:id/attachment', im, uploadLimiter, v({ params: idParam }), taskPdfUpload, A.uploadTaskPdf);
r.get('/internship-tasks/:id', im, v({ params: idParam }), A.getTask);
r.patch('/internship-tasks/:id', im, v({ params: idParam, body: S.taskUpdateBody }), A.updateTask);
r.post('/internship-tasks/:id/status', im, v({ params: idParam, body: S.taskStatusBody }), A.setTaskStatus);
r.delete('/internship-tasks/:id', im, v({ params: idParam }), A.deleteTask);

// Submission reviews (assigned reviewers and admins; scope enforced in the service)
const rv = perm('submissions:review-assigned', 'submissions:review-all');
r.get('/internship-submissions', rv, v({ query: S.reviewQueueQuery }), A.reviewQueue);
r.get('/internship-submissions/programs', rv, A.reviewPrograms);
r.get('/internship-submissions/:id', rv, v({ params: idParam }), A.getSubmission);
r.post('/internship-submissions/:id/start-review', rv, v({ params: idParam }), A.startReview);
r.post('/internship-submissions/:id/assessments', rv, v({ params: idParam, body: S.assessmentBody }), A.assess);
r.post('/internship-assessments/:id/amend', perm('assessments:amend'), v({ params: idParam, body: S.amendmentBody }), A.amend);

// Certificates
const cm = perm('certificates:manage');
r.get('/internship-certificates', cm, v({ query: S.certificateListQuery }), A.listCertificates);
r.get('/internship-certificates/:id/download', cm, v({ params: idParam }), A.downloadCertificate);
r.post('/internship-certificates/:id/revoke', cm, v({ params: idParam, body: S.revokeBody }), A.revokeCertificate);
r.get('/certificate-payments', cm, v({ query: S.certificatePaymentListQuery }), A.listCertificatePayments);
r.get('/certificate-payments/:id/receipt', cm, v({ params: idParam }), A.downloadCertificatePaymentReceipt);
r.post('/certificate-payments/:id/review', cm, v({ params: idParam, body: S.certificatePaymentReviewBody }), A.reviewCertificatePayment);

// Contact messages, audit log, settings
r.get('/messages', perm('messages:manage'), v({ query: S.messageListQuery }), A.listMessages);
r.patch('/messages/:id', perm('messages:manage'), v({ params: idParam, body: S.messageStatusBody }), A.updateMessage);
r.get('/audit-logs', perm('reports:view'), v({ query: S.auditQuery }), A.auditLogs);
r.get('/settings', perm('settings:manage'), A.getSettings);
r.put('/settings', perm('settings:manage'), v({ body: S.settingsBody }), A.updateSettings);

export default r;
