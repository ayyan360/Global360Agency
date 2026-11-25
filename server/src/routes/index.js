import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import { authLimiter, contactLimiter, applicationLimiter, uploadLimiter, assistantLimiter } from '../middleware/rateLimits.js';
import { submissionUpload } from '../middleware/upload.js';
import { certificateReceiptUpload } from '../middleware/receiptUpload.js';
import * as S from '../validators/schemas.js';
import { idParam, uuid } from '../validators/common.js';
import * as auth from '../controllers/authController.js';
import * as pub from '../controllers/publicController.js';
import * as student from '../controllers/studentController.js';
import * as aiAssistant from '../controllers/aiAssistantController.js';
import adminRoutes from './admin.js';

const r = Router();

// ---------- General ----------
r.get('/health', pub.health);

// ---------- Authentication ----------
r.get('/auth/csrf', auth.csrf);
r.post('/auth/register', authLimiter, validate({ body: S.registerBody }), auth.register);
r.post('/auth/login', authLimiter, validate({ body: S.loginBody }), auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', auth.me); // returns { user: null } when signed out
r.post('/auth/change-password', requireAuth, authLimiter, validate({ body: S.changePasswordBody }), auth.changePassword);
r.patch('/auth/profile', requireAuth, validate({ body: S.profileBody }), auth.updateProfile);

// ---------- Public content ----------
r.get('/home', pub.home);
r.get('/stats', pub.stats);
r.get('/settings', pub.settings);
r.post('/contact', contactLimiter, validate({ body: S.contactBody }), pub.contact);
r.get('/courses', validate({ query: S.courseListQuery }), pub.listCourses);
r.get('/courses/categories', pub.categories);
r.get('/courses/:slug', validate({ params: z.object({ slug: z.string().max(180) }) }), pub.getCourse);
r.get('/internships', pub.listInternships);
r.get('/internships/tracks', pub.tracks);
r.get('/internships/:slug', validate({ params: z.object({ slug: z.string().max(180) }) }), pub.getInternship);
r.get('/certificates/verify/:certificateNumber', validate({ params: z.object({ certificateNumber: z.string().max(40) }) }), pub.verify);

// ---------- Learning (authenticated) ----------
const courseIdParam = z.object({ courseId: uuid });
const lessonIdParam = z.object({ lessonId: uuid });
r.post('/courses/:courseId/enroll', requireAuth, validate({ params: courseIdParam }), student.enroll);
r.get('/student/courses/:courseId/certificate/download', requireAuth, validate({ params: courseIdParam }), student.downloadCourseCertificate);
r.put('/courses/:courseId/review', requireAuth, validate({ params: courseIdParam, body: S.reviewBody }), student.review);
r.post('/courses/:courseId/wishlist', requireAuth, validate({ params: courseIdParam }), student.toggleWishlist);
r.get('/lessons/:lessonId', validate({ params: lessonIdParam }), student.getLesson); // preview lessons are public; others checked in service
r.post('/lessons/:lessonId/complete', requireAuth, validate({ params: lessonIdParam, body: S.lessonCompleteBody }), student.completeLesson);
r.post('/ai-assistant/chat', requireAuth, assistantLimiter, validate({ body: S.aiAssistantBody }), aiAssistant.chat);

r.get('/student/dashboard', requireAuth, student.dashboard);
r.get('/student/courses', requireAuth, student.myCourses);
r.get('/student/progress', requireAuth, student.progress);
r.get('/student/wishlist', requireAuth, student.wishlist);

// ---------- Internship (participants) ----------
r.post('/internships/:programId/applications', requireAuth, requireRole('student'), applicationLimiter, validate({ params: z.object({ programId: uuid }), body: S.applicationBody }), student.apply);
r.get('/student/internship/applications', requireAuth, student.myApplications);
r.post('/student/internship/applications/:id/withdraw', requireAuth, validate({ params: idParam }), student.withdrawApplication);
r.get('/student/internship', requireAuth, student.internshipDashboard);
r.post('/student/internship/withdraw', requireAuth, requireRole('student'), validate({ body: S.withdrawBody }), student.withdrawInternship);
r.get('/student/internship/tasks', requireAuth, validate({ query: S.weekQuery }), student.internshipTasks);
const taskIdParam = z.object({ taskId: uuid });
r.get('/student/internship/tasks/:taskId', requireAuth, validate({ params: taskIdParam }), student.internshipTask);
r.get('/student/internship/tasks/:taskId/attachment', requireAuth, validate({ params: taskIdParam }), student.downloadTaskAttachment);
r.get('/student/internship/tasks/:taskId/submissions', requireAuth, validate({ params: taskIdParam }), student.taskSubmissions);
r.post(
  '/student/internship/tasks/:taskId/submissions',
  requireAuth,
  requireRole('student'),
  uploadLimiter,
  submissionUpload,
  validate({ params: taskIdParam, body: S.submissionBody }),
  student.submitTask
);
r.get('/student/internship/progress', requireAuth, student.internshipProgress);
r.get('/student/internship/certificate', requireAuth, student.internshipCertificate);
r.get('/student/internship/certificate/download', requireAuth, student.downloadCertificate);
r.post(
  '/student/certificate-payments/:certificateType/:certificateId/receipt',
  requireAuth,
  uploadLimiter,
  validate({ params: z.object({ certificateType: z.enum(['course', 'internship']), certificateId: uuid }) }),
  certificateReceiptUpload,
  student.submitCertificatePaymentReceipt
);

// Private files (ownership/assignment checked in service)
r.get('/attachments/:id', requireAuth, validate({ params: idParam }), student.downloadAttachment);

// ---------- Notifications ----------
r.get('/notifications', requireAuth, validate({ query: S.notificationQuery }), student.listNotifications);
r.get('/notifications/unread-count', requireAuth, student.unreadCount);
r.post('/notifications/read-all', requireAuth, student.markAllRead);
r.post('/notifications/:id/read', requireAuth, validate({ params: idParam }), student.markRead);

// ---------- Administration ----------
r.use('/admin', requireAuth, requirePermission('courses:manage', 'courses:manage-own', 'submissions:review-assigned'), adminRoutes);

export default r;
