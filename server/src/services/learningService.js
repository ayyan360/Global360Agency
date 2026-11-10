import { QueryTypes } from 'sequelize';
import { issueCourseCertificate } from './courseCertificateService.js';
import {
  sequelize,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  CourseCertificate,
  LessonProgress,
  Review,
  Wishlist,
  User,
} from '../models/index.js';
import { notFound, forbidden, conflict, badRequest, unauthorized } from '../utils/errors.js';
import { canManageCourse, serializeCourseCard } from './courseService.js';
import { certificatePaymentSummary } from './certificatePaymentService.js';

/** Per-course lesson totals and completed counts for a user, straight from PostgreSQL. */
export async function courseProgressFor(userId, courseIds) {
  if (!courseIds.length) return {};
  const rows = await sequelize.query(
    `SELECT m."courseId" AS "courseId",
            COUNT(l.id)::int AS "totalLessons",
            COUNT(lp.id) FILTER (WHERE lp."isCompleted")::int AS "completedLessons"
       FROM course_modules m
       JOIN lessons l ON l."moduleId" = m.id
       LEFT JOIN lesson_progress lp ON lp."lessonId" = l.id AND lp."userId" = :userId
      WHERE m."courseId" IN (:courseIds)
      GROUP BY m."courseId"`,
    { replacements: { userId, courseIds }, type: QueryTypes.SELECT }
  );
  const map = {};
  for (const r of rows) {
    map[r.courseId] = {
      totalLessons: r.totalLessons,
      completedLessons: r.completedLessons,
      progress: r.totalLessons ? Math.round((r.completedLessons / r.totalLessons) * 100) : 0,
    };
  }
  return map;
}

async function orderedLessons(courseId, transaction) {
  return Lesson.findAll({
    include: [{ model: CourseModule, as: 'module', where: { courseId }, attributes: ['id', 'title', 'position'] }],
    order: [
      [{ model: CourseModule, as: 'module' }, 'position', 'ASC'],
      ['position', 'ASC'],
    ],
    transaction,
  });
}

export async function enrollInCourse(user, courseId) {
  const course = await Course.findByPk(courseId);
  if (!course || course.status !== 'published') throw notFound('Course not found.');
  if (!course.isFree) throw badRequest('This course is not available for free enrollment.');
  try {
    const enrollment = await CourseEnrollment.create({ userId: user.id, courseId: course.id, status: 'active' });
    return { enrollment, course };
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw conflict('You are already enrolled in this course.', { code: 'ALREADY_ENROLLED' });
    }
    throw err;
  }
}

/**
 * Lesson access rules (enforced here, on the server):
 *  - lessons marked isPreview on a published course are public;
 *  - otherwise the viewer must hold an active/completed enrollment,
 *    or be an admin / the course's instructor.
 */
export async function getLessonForViewer(user, lessonId) {
  const lesson = await Lesson.findByPk(lessonId, {
    include: [{ model: CourseModule, as: 'module', include: [{ model: Course, as: 'course' }] }],
  });
  if (!lesson) throw notFound('Lesson not found.');
  const course = lesson.module.course;
  const manager = canManageCourse(user, course);
  if (course.status !== 'published' && !manager) throw notFound('Lesson not found.');

  let enrollment = null;
  if (user) {
    enrollment = await CourseEnrollment.findOne({ where: { userId: user.id, courseId: course.id } });
  }
  const enrolled = Boolean(enrollment && enrollment.status !== 'cancelled');
  if (!lesson.isPreview && !enrolled && !manager) {
    if (!user) throw unauthorized('Please log in and enroll to access this lesson.');
    throw forbidden('Enroll in this course to access this lesson.');
  }

  const lessons = await orderedLessons(course.id);
  const index = lessons.findIndex((l) => l.id === lesson.id);
  let completedIds = new Set();
  if (user && enrolled) {
    const done = await LessonProgress.findAll({
      where: { userId: user.id, courseId: course.id, isCompleted: true },
      attributes: ['lessonId'],
    });
    completedIds = new Set(done.map((d) => d.lessonId));
    await LessonProgress.findOrCreate({
      where: { userId: user.id, lessonId: lesson.id },
      defaults: { userId: user.id, lessonId: lesson.id, courseId: course.id, isCompleted: false, lastViewedAt: new Date() },
    }).then(([row, created]) => (created ? row : row.update({ lastViewedAt: new Date() })));
  }

  // Build module outline with access flags.
  const modules = [];
  for (const l of lessons) {
    let m = modules.find((x) => x.id === l.module.id);
    if (!m) {
      m = { id: l.module.id, title: l.module.title, position: l.module.position, lessons: [] };
      modules.push(m);
    }
    m.lessons.push({
      id: l.id,
      title: l.title,
      durationSeconds: l.durationSeconds,
      isPreview: l.isPreview,
      isCompleted: completedIds.has(l.id),
      isLocked: !(l.isPreview || enrolled || manager),
    });
  }

  const total = lessons.length;
  const completed = completedIds.size;
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.videoUrl,
      durationSeconds: lesson.durationSeconds,
      isPreview: lesson.isPreview,
      isCompleted: completedIds.has(lesson.id),
      moduleTitle: lesson.module.title,
    },
    course: { id: course.id, title: course.title, slug: course.slug, category: course.category },
    modules,
    navigation: {
      previousLessonId: index > 0 ? lessons[index - 1].id : null,
      nextLessonId: index < total - 1 ? lessons[index + 1].id : null,
      position: index + 1,
      total,
    },
    progress: { completedLessons: completed, totalLessons: total, progress: total ? Math.round((completed / total) * 100) : 0 },
    viewer: {
      isEnrolled: enrolled,
      canTrackProgress: enrolled && (enrollment.status !== 'completed' || !course.curriculumLocked),
      curriculumLocked: course.curriculumLocked,
    },
  };
}

export async function setLessonCompletion(user, lessonId, isCompleted = true) {
  const lesson = await Lesson.findByPk(lessonId, { include: [{ model: CourseModule, as: 'module', attributes: ['courseId'] }] });
  if (!lesson) throw notFound('Lesson not found.');
  const courseId = lesson.module.courseId;

  return sequelize.transaction(async (transaction) => {
    const course = await Course.findByPk(courseId, { attributes: ['curriculumLocked'], transaction, lock: transaction.LOCK.UPDATE });
    const enrollment = await CourseEnrollment.findOne({ where: { userId: user.id, courseId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!enrollment || enrollment.status === 'cancelled') throw forbidden('Enroll in this course to track progress.');
    if (enrollment.status === 'completed' && course.curriculumLocked) throw conflict('This course enrollment is already completed.');

    const [progress] = await LessonProgress.findOrCreate({
      where: { userId: user.id, lessonId },
      defaults: { userId: user.id, lessonId, courseId },
      transaction,
    });
    await progress.update(
      { isCompleted, completedAt: isCompleted ? progress.completedAt || new Date() : null, lastViewedAt: new Date() },
      { transaction }
    );

    const lessons = await Lesson.findAll({
      include: [{ model: CourseModule, as: 'module', where: { courseId }, attributes: [] }],
      attributes: ['id'],
      transaction,
    });
    const total = lessons.length;
    const completed = await LessonProgress.count({
      where: { userId: user.id, courseId, isCompleted: true, lessonId: lessons.map((item) => item.id) },
      transaction,
    });
    const allDone = total > 0 && completed === total;
    if (allDone && enrollment.status !== 'completed') await enrollment.update({ status: 'completed', completedAt: new Date() }, { transaction });
    if (!allDone && enrollment.status === 'completed') await enrollment.update({ status: 'active', completedAt: null }, { transaction });

    if (allDone && course.curriculumLocked) await issueCourseCertificate(enrollment, user, { transaction });

    return {
      lessonId,
      isCompleted,
      courseProgress: { completedLessons: completed, totalLessons: total, progress: total ? Math.round((completed / total) * 100) : 0 },
      courseCompleted: allDone,
      certificateAvailable: allDone && course.curriculumLocked,
    };
  });
}

async function enrolledCourses(userId) {
  const enrollments = await CourseEnrollment.findAll({
    where: { userId },
    include: [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title', 'slug', 'shortDescription', 'thumbnailUrl', 'category', 'level', 'isFree', 'isSample', 'status', 'curriculumLocked', 'certificateFee'],
        include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }],
      },
      { model: CourseCertificate, as: 'certificate', attributes: ['id', 'certificateNumber', 'recipientName', 'completionDate', 'issuedAt'] },
    ],
    order: [['enrolledAt', 'DESC']],
  });
  const progress = await courseProgressFor(userId, enrollments.map((e) => e.courseId));
  const lastViewed = await sequelize.query(
    `SELECT DISTINCT ON (lp."courseId") lp."courseId", lp."lessonId"
       FROM lesson_progress lp WHERE lp."userId" = :userId
      ORDER BY lp."courseId", lp."lastViewedAt" DESC NULLS LAST`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  const lastMap = Object.fromEntries(lastViewed.map((r) => [r.courseId, r.lessonId]));

  const items = [];
  const paymentSummaries = await Promise.all(enrollments.map(async (enrollment) => {
    if (!enrollment.certificate) return null;
    return certificatePaymentSummary({
      certificateType: 'course',
      certificate: enrollment.certificate,
      userId,
      fee: enrollment.course.certificateFee,
    });
  }));
  const paymentByEnrollment = new Map(enrollments.map((enrollment, index) => [enrollment.id, paymentSummaries[index]]));
  for (const e of enrollments) {
    if (e.status === 'cancelled') continue;
    const p = progress[e.courseId] || { totalLessons: 0, completedLessons: 0, progress: 0 };
    let continueLessonId = lastMap[e.courseId] || null;
    if (!continueLessonId || p.progress === 100 || e.status === 'completed') {
      const lessons = await orderedLessons(e.courseId);
      const done = new Set(
        (await LessonProgress.findAll({ where: { userId, courseId: e.courseId, isCompleted: true }, attributes: ['lessonId'] })).map((x) => x.lessonId)
      );
      continueLessonId = (e.status === 'completed' ? lessons[0] : lessons.find((l) => !done.has(l.id)) || lessons[0])?.id || null;
    }
    items.push({
      enrollmentId: e.id,
      status: p.totalLessons > 0 && p.progress === 100 ? 'completed' : 'active',
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      course: {
        id: e.course.id,
        title: e.course.title,
        slug: e.course.slug,
        shortDescription: e.course.shortDescription,
        thumbnailUrl: e.course.thumbnailUrl,
        category: e.course.category,
        level: e.course.level,
        isSample: e.course.isSample,
        curriculumLocked: e.course.curriculumLocked,
        certificateFee: e.course.certificateFee,
        instructor: e.course.instructor ? { id: e.course.instructor.id, name: e.course.instructor.name } : null,
      },
      certificate: e.certificate ? e.certificate.toJSON() : null,
      certificatePayment: e.certificate ? paymentByEnrollment.get(e.id) : null,
      ...p,
      remainingLessons: p.totalLessons - p.completedLessons,
      continueLessonId,
    });
  }
  return items;
}

export async function recentActivity(userId, limit = 8) {
  const rows = await LessonProgress.findAll({
    where: { userId },
    include: [
      { model: Lesson, as: 'lesson', attributes: ['id', 'title'] },
      { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
    ],
    order: [['updatedAt', 'DESC']],
    limit,
  });
  return rows.map((r) => ({
    type: r.isCompleted ? 'lesson_completed' : 'lesson_viewed',
    at: r.isCompleted && r.completedAt ? r.completedAt : r.lastViewedAt || r.updatedAt,
    lesson: r.lesson && { id: r.lesson.id, title: r.lesson.title },
    course: r.course && { id: r.course.id, title: r.course.title, slug: r.course.slug },
  }));
}

export async function studentDashboard(user) {
  const courses = await enrolledCourses(user.id);
  const totals = courses.reduce(
    (acc, c) => ({ totalLessons: acc.totalLessons + c.totalLessons, completedLessons: acc.completedLessons + c.completedLessons }),
    { totalLessons: 0, completedLessons: 0 }
  );
  return {
    stats: {
      enrolledCourses: courses.length,
      completedCourses: courses.filter((c) => c.status === 'completed').length,
      completedLessons: totals.completedLessons,
      totalLessons: totals.totalLessons,
      overallProgress: totals.totalLessons ? Math.round((totals.completedLessons / totals.totalLessons) * 100) : 0,
    },
    courses: courses.slice(0, 4),
    recentActivity: await recentActivity(user.id, 6),
  };
}

export const studentCourses = (user) => enrolledCourses(user.id);

export async function studentProgress(user) {
  const courses = await enrolledCourses(user.id);
  const total = courses.reduce((a, c) => a + c.totalLessons, 0);
  const done = courses.reduce((a, c) => a + c.completedLessons, 0);
  return {
    overall: { completedLessons: done, totalLessons: total, remainingLessons: total - done, progress: total ? Math.round((done / total) * 100) : 0 },
    courses,
    recentActivity: await recentActivity(user.id, 15),
  };
}

export async function upsertReview(user, courseId, { rating, comment }) {
  const enrollment = await CourseEnrollment.findOne({ where: { userId: user.id, courseId } });
  if (!enrollment || enrollment.status === 'cancelled') throw forbidden('Only enrolled students can review this course.');
  const [review, created] = await Review.findOrCreate({ where: { userId: user.id, courseId }, defaults: { userId: user.id, courseId, rating, comment } });
  if (!created) await review.update({ rating, comment });
  return review;
}

export async function toggleWishlist(user, courseId) {
  const course = await Course.findOne({ where: { id: courseId, status: 'published' }, attributes: ['id'] });
  if (!course) throw notFound('Course not found.');
  const existing = await Wishlist.findOne({ where: { userId: user.id, courseId } });
  if (existing) {
    await existing.destroy();
    return { inWishlist: false };
  }
  await Wishlist.create({ userId: user.id, courseId });
  return { inWishlist: true };
}

export async function listWishlist(user) {
  const rows = await Wishlist.findAll({
    where: { userId: user.id },
    include: [{ model: Course, as: 'course', where: { status: 'published' }, include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }] }],
    order: [['createdAt', 'DESC']],
  });
  return rows.map((w) => serializeCourseCard(w.course));
}
