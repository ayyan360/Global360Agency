import { randomUUID } from 'node:crypto';
import { Course, CourseCertificate, CourseEnrollment, CourseModule, Lesson, LessonProgress } from '../models/index.js';
import { forbidden, notFound } from '../utils/errors.js';
import { renderCertificatePdf } from './certificateDesignPdf.js';
import { assertCertificatePaymentApproved } from './certificatePaymentService.js';

export async function issueCourseCertificate(enrollment, user, { transaction } = {}) {
  const course = await Course.findByPk(enrollment.courseId, { attributes: ['title', 'curriculumLocked'], transaction });
  if (!course?.curriculumLocked) throw forbidden('Lock the course curriculum before issuing certificates.');
  const lessons = await Lesson.findAll({
    include: [{ model: CourseModule, as: 'module', where: { courseId: enrollment.courseId }, attributes: [] }],
    attributes: ['id'],
    transaction,
  });
  const completedLessons = await LessonProgress.count({
    where: { userId: enrollment.userId, courseId: enrollment.courseId, isCompleted: true, lessonId: lessons.map((lesson) => lesson.id) },
    transaction,
  });
  if (!lessons.length || completedLessons !== lessons.length) throw forbidden('Complete every lesson to qualify for a certificate.');
  const completionDate = enrollment.completedAt || new Date();
  const certificateNumber = `G360-C-${completionDate.getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  const [certificate] = await CourseCertificate.findOrCreate({
    where: { enrollmentId: enrollment.id },
    defaults: {
      enrollmentId: enrollment.id,
      certificateNumber,
      recipientName: user.name,
      courseTitle: course.title,
      completionDate,
    },
    transaction,
  });
  return certificate;
}

export async function getCourseCertificatePdfForUser(user, courseId) {
  const enrollment = await CourseEnrollment.findOne({ where: { userId: user.id, courseId } });
  if (!enrollment) throw notFound('Course enrollment not found.');
  const course = await Course.findByPk(courseId, { attributes: ['curriculumLocked', 'certificateFee'] });
  const lessons = await Lesson.findAll({
    include: [{ model: CourseModule, as: 'module', where: { courseId }, attributes: [] }],
    attributes: ['id'],
  });
  const completedLessons = await LessonProgress.count({
    where: { userId: user.id, courseId, isCompleted: true, lessonId: lessons.map((lesson) => lesson.id) },
  });
  if (!course?.curriculumLocked || !lessons.length || completedLessons !== lessons.length) {
    throw forbidden('Complete every lesson after the course curriculum is locked to qualify for a certificate.');
  }

  const certificate = await CourseCertificate.findOne({ where: { enrollmentId: enrollment.id } });
  if (!certificate) throw notFound('Your certificate has not been issued yet.');
  await assertCertificatePaymentApproved({ certificateType: 'course', certificate, userId: user.id, fee: course.certificateFee });
  return {
    certificate,
    pdf: await renderCertificatePdf({
      recipientName: certificate.recipientName,
      title: 'Course Completion Certificate',
      description: `for successfully completing the course ${certificate.courseTitle}, in recognition of your dedication, hard work and valuable contribution to Global360 Agency.`,
      completionDate: certificate.completionDate,
      certificateNumber: certificate.certificateNumber,
    }),
  };
}