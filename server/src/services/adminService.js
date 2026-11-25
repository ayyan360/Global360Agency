import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  User,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  CourseCertificate,
  LessonProgress,
  InternshipEnrollment,
  InternshipProgram,
  InternshipCertificate,
  ContactMessage,
  AuditLog,
} from '../models/index.js';
import { notFound, badRequest, forbidden, conflict } from '../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../utils/pagination.js';
import { uniqueSlug } from '../utils/slug.js';
import { can } from '../utils/permissions.js';
import { audit } from './auditService.js';
import { hashPassword, revokeAllSessions, serializeUser } from './authService.js';
import { courseProgressFor } from './learningService.js';
import { firstLessonVideoAttribute } from './courseService.js';
import { issueCourseCertificate } from './courseCertificateService.js';
import { notify } from './notificationService.js';
import { youtubeThumbnailUrl } from '../utils/youtube.js';

// ---------------- Dashboard ----------------

export async function dashboardStats() {
  const [row] = await sequelize.query(
    `SELECT
      (SELECT COUNT(*)::int FROM courses) AS "totalCourses",
      (SELECT COUNT(*)::int FROM courses WHERE status = 'published') AS "publishedCourses",
      (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS "totalStudents",
      (SELECT COUNT(*)::int FROM course_enrollments) AS "totalEnrollments",
      (SELECT COUNT(DISTINCT "instructorId")::int FROM courses WHERE "instructorId" IS NOT NULL AND status = 'published') AS "activeInstructors",
      (SELECT COUNT(*)::int FROM internship_programs WHERE status <> 'archived') AS "internshipPrograms",
      (SELECT COUNT(*)::int FROM internship_applications WHERE status IN ('pending','under_review')) AS "pendingApplications",
      (SELECT COUNT(*)::int FROM internship_enrollments WHERE status IN ('approved','in_progress')) AS "activeParticipants",
      (SELECT COUNT(*)::int FROM task_submissions WHERE status IN ('submitted','under_review')) AS "pendingSubmissions",
      (SELECT COUNT(*)::int FROM internship_enrollments WHERE status IN ('completed_qualified','completed_not_qualified')) AS "completedInternships",
      (SELECT COUNT(*)::int FROM internship_certificates WHERE status = 'valid') AS "certificatesIssued",
      (SELECT COUNT(*)::int FROM contact_messages WHERE status = 'new') AS "newMessages"`,
    { type: QueryTypes.SELECT }
  );
  const recentEnrollments = await CourseEnrollment.findAll({
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
    ],
    order: [['enrolledAt', 'DESC']],
    limit: 6,
  });
  const enrollmentTrend = await sequelize.query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS date, COALESCE(c.count, 0)::int AS count
       FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d
       LEFT JOIN (SELECT date_trunc('day', "enrolledAt") AS day, COUNT(*) AS count FROM course_enrollments
                   WHERE "enrolledAt" >= current_date - interval '13 days' GROUP BY 1) c ON c.day = d
      ORDER BY d`,
    { type: QueryTypes.SELECT }
  );
  return { stats: row, recentEnrollments, enrollmentTrend };
}

// ---------------- Users ----------------

export async function listUsers({ search, role, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (role) where.role = role;
  if (status) where.accountStatus = status;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: likeTerm(search) } }, { email: { [Op.iLike]: likeTerm(search) } }];
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: {
      exclude: ['passwordHash'],
      include: [
        [sequelize.literal(`(SELECT COUNT(*)::int FROM course_enrollments e WHERE e."userId" = "User"."id")`), 'courseEnrollments'],
        [sequelize.literal(`(SELECT COUNT(*)::int FROM internship_enrollments e WHERE e."userId" = "User"."id")`), 'internshipEnrollments'],
      ],
    },
    order: [['createdAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows.map((u) => u.toJSON()), meta: pageMeta({ page, pageSize }, count) };
}

export async function getUserDetail(id) {
  const user = await User.findByPk(id);
  if (!user) throw notFound('User not found.');
  const enrollments = await CourseEnrollment.findAll({ where: { userId: id }, include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'slug'] }], order: [['enrolledAt', 'DESC']] });
  const progress = await courseProgressFor(id, enrollments.map((e) => e.courseId));
  const internships = await InternshipEnrollment.findAll({
    where: { userId: id },
    include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track'] }, { model: InternshipCertificate, as: 'certificate', attributes: ['certificateNumber', 'status'] }],
    order: [['enrolledAt', 'DESC']],
  });
  return {
    user: serializeUser(user),
    lastLoginAt: user.lastLoginAt,
    courseEnrollments: enrollments.map((e) => ({ id: e.id, status: e.status, enrolledAt: e.enrolledAt, course: e.course, ...(progress[e.courseId] || { progress: 0, totalLessons: 0, completedLessons: 0 }) })),
    internshipEnrollments: internships,
  };
}

/** Role and account status changes. Admins cannot change their own role/status, and only admins may grant admin. */
export async function updateUserAdmin(actor, id, { role, accountStatus, name }, { ip } = {}) {
  const user = await User.findByPk(id);
  if (!user) throw notFound('User not found.');
  const changes = {};
  if (role && role !== user.role) {
    if (!can(actor, 'roles:manage')) throw forbidden();
    if (actor.id === user.id) throw forbidden('You cannot change your own role.');
    if (user.role === 'admin') {
      const admins = await User.count({ where: { role: 'admin', accountStatus: 'active' } });
      if (admins <= 1) throw conflict('Cannot remove the last active admin.');
    }
    changes.role = role;
  }
  if (accountStatus && accountStatus !== user.accountStatus) {
    if (actor.id === user.id) throw forbidden('You cannot change your own account status.');
    changes.accountStatus = accountStatus;
  }
  if (name && name !== user.name) changes.name = name;
  if (!Object.keys(changes).length) return serializeUser(user);
  const before = { role: user.role, accountStatus: user.accountStatus, name: user.name };
  await user.update(changes);
  if (changes.role || (changes.accountStatus && changes.accountStatus !== 'active')) await revokeAllSessions(user.id);
  await audit({
    actorId: actor.id,
    action: changes.role ? 'user.role_changed' : 'user.updated',
    entityType: 'User',
    entityId: user.id,
    metadata: { before, after: { role: user.role, accountStatus: user.accountStatus, name: user.name } },
    ip,
  });
  if (changes.role) {
    await notify({ userId: user.id, type: 'role_changed', title: 'Account role updated', message: `Your account role is now "${user.role}".` });
  }
  return serializeUser(user);
}

/** Admin-created staff accounts (instructor/reviewer/admin). Public registration can only create students. */
export async function createStaffUser(actor, { name, email, password, role }, { ip } = {}) {
  if (!can(actor, 'roles:manage')) throw forbidden();
  const exists = await User.findOne({ where: { email: email.toLowerCase() } });
  if (exists) throw conflict('An account with this email already exists.');
  const user = await User.create({ name, email, passwordHash: await hashPassword(password), role, passwordChangedAt: new Date() });
  await audit({ actorId: actor.id, action: 'user.created', entityType: 'User', entityId: user.id, metadata: { role, email: user.email }, ip });
  return serializeUser(user);
}

// ---------------- Courses ----------------

function courseScope(user) {
  return can(user, 'courses:manage') ? {} : { instructorId: user.id };
}

async function findManagedCourse(user, id, opts = {}) {
  const course = await Course.findOne({ where: { id, ...courseScope(user) }, ...opts });
  if (!course) throw notFound('Course not found.');
  return course;
}

async function findEditableCourse(user, id, opts = {}) {
  const course = await findManagedCourse(user, id, opts);
  if (course.curriculumLocked) throw conflict('This course curriculum is locked. Modules and lessons can no longer be changed.');
  return course;
}

export async function lockCourseCurriculum(user, id, { ip } = {}) {
  return sequelize.transaction(async (transaction) => {
    const course = await findManagedCourse(user, id, { transaction, lock: transaction.LOCK.UPDATE });
    const wasLocked = course.curriculumLocked;
    if (!wasLocked) await course.update({ curriculumLocked: true }, { transaction });

    const lessons = await Lesson.findAll({
      include: [{ model: CourseModule, as: 'module', where: { courseId: id }, attributes: [] }],
      attributes: ['id'],
      transaction,
    });
    if (!lessons.length) throw badRequest('Add at least one lesson before locking the course curriculum.');
    const enrollments = await CourseEnrollment.findAll({
      where: { courseId: id, status: ['active', 'completed'] },
      include: [{ model: User, as: 'user' }],
      transaction,
      lock: { level: transaction.LOCK.UPDATE, of: CourseEnrollment },
    });
    let certificatesIssued = 0;
    if (lessons.length > 0) {
      for (const enrollment of enrollments) {
        const completedLessons = await LessonProgress.count({
          where: { userId: enrollment.userId, courseId: id, isCompleted: true, lessonId: lessons.map((lesson) => lesson.id) },
          transaction,
        });
        if (completedLessons !== lessons.length) continue;
        await enrollment.update({ status: 'completed', completedAt: enrollment.completedAt || new Date() }, { transaction });
        const existing = await CourseCertificate.findOne({ where: { enrollmentId: enrollment.id }, transaction });
        if (!existing) {
          await issueCourseCertificate(enrollment, enrollment.user, { transaction });
          certificatesIssued += 1;
        }
      }
    }

    if (!wasLocked) {
      await audit({
        actorId: user.id,
        action: 'course.curriculum_locked',
        entityType: 'Course',
        entityId: course.id,
        metadata: { title: course.title, certificatesIssued },
        ip,
        transaction,
      });
    }
    return { course, certificatesIssued };
  });
}

export async function adminListCourses(user, { search, status, category, page = 1, pageSize = 20 }) {
  const where = { ...courseScope(user) };
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) where.title = { [Op.iLike]: likeTerm(search) };
  const { rows, count } = await Course.findAndCountAll({
    where,
    attributes: {
      include: [
        [sequelize.literal(`(SELECT COUNT(*)::int FROM course_modules m WHERE m."courseId" = "Course"."id")`), 'moduleCount'],
        [sequelize.literal(`(SELECT COUNT(*)::int FROM lessons l JOIN course_modules m ON m.id = l."moduleId" WHERE m."courseId" = "Course"."id")`), 'lessonCount'],
        [sequelize.literal(`(SELECT COUNT(*)::int FROM course_enrollments e WHERE e."courseId" = "Course"."id")`), 'enrollmentCount'],
        firstLessonVideoAttribute(),
      ],
    },
    include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }],
    order: [['updatedAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  const items = rows.map((row) => {
    const { firstLessonVideoUrl, ...course } = row.get({ plain: true });
    return { ...course, lessonThumbnailUrl: youtubeThumbnailUrl(firstLessonVideoUrl) };
  });
  return { items, meta: pageMeta({ page, pageSize }, count) };
}

export async function adminGetCourse(user, id) {
  const course = await findManagedCourse(user, id, {
    include: [
      { model: User, as: 'instructor', attributes: ['id', 'name', 'email'] },
      { model: CourseModule, as: 'modules', include: [{ model: Lesson, as: 'lessons' }] },
    ],
    order: [
      [{ model: CourseModule, as: 'modules' }, 'position', 'ASC'],
      [{ model: CourseModule, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'position', 'ASC'],
    ],
  });
  return course;
}

async function validateInstructor(instructorId) {
  if (!instructorId) return;
  const instructor = await User.findByPk(instructorId);
  if (!instructor || !['instructor', 'admin'].includes(instructor.role)) throw badRequest('The selected instructor must be an instructor or admin account.');
}

export async function createCourse(user, data, { ip } = {}) {
  if (!can(user, 'courses:manage')) data.instructorId = user.id;
  await validateInstructor(data.instructorId);
  const slug = await uniqueSlug(Course, data.slug || data.title);
  const course = await Course.create({ ...data, slug, publishedAt: data.status === 'published' ? new Date() : null });
  await audit({ actorId: user.id, action: 'course.created', entityType: 'Course', entityId: course.id, metadata: { title: course.title }, ip });
  return course;
}

export async function updateCourse(user, id, data, { ip } = {}) {
  const course = await findManagedCourse(user, id);
  if (!can(user, 'courses:manage')) delete data.instructorId;
  if (data.instructorId !== undefined) await validateInstructor(data.instructorId);
  if (data.slug && data.slug !== course.slug) data.slug = await uniqueSlug(Course, data.slug, { excludeId: id });
  if (data.status === 'published' && !course.publishedAt) data.publishedAt = new Date();
  await course.update(data);
  await audit({ actorId: user.id, action: 'course.updated', entityType: 'Course', entityId: id, metadata: { fields: Object.keys(data) }, ip });
  return course;
}

export async function deleteCourse(user, id, { ip } = {}) {
  const course = await findManagedCourse(user, id);
  const enrollments = await CourseEnrollment.count({ where: { courseId: id } });
  if (enrollments > 0) throw conflict(`This course has ${enrollments} enrollment(s). Archive it instead of deleting it.`);
  await course.destroy();
  await audit({ actorId: user.id, action: 'course.deleted', entityType: 'Course', entityId: id, metadata: { title: course.title }, ip });
}

export async function createModule(user, courseId, data) {
  return sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, courseId, { transaction, lock: transaction.LOCK.UPDATE });
    const position = data.position ?? (await CourseModule.count({ where: { courseId }, transaction }));
    return CourseModule.create({ ...data, courseId, position }, { transaction });
  });
}

async function findManagedModule(user, id) {
  const mod = await CourseModule.findByPk(id);
  if (!mod) throw notFound('Module not found.');
  await findManagedCourse(user, mod.courseId);
  return mod;
}

export async function updateModule(user, id, data) {
  const mod = await findManagedModule(user, id);
  return sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, mod.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    await mod.update(data, { transaction });
    return mod;
  });
}

export async function deleteModule(user, id) {
  const mod = await findManagedModule(user, id);
  await sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, mod.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    await mod.destroy({ transaction });
  });
}

export async function reorderModules(user, courseId, orderedIds) {
  await sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, courseId, { transaction, lock: transaction.LOCK.UPDATE });
    const modules = await CourseModule.findAll({ where: { courseId }, transaction });
    const ids = new Set(modules.map((m) => m.id));
    if (orderedIds.length !== ids.size || orderedIds.some((i) => !ids.has(i))) throw badRequest('The new order must list every module of the course exactly once.');
    for (const [i, id] of orderedIds.entries()) await CourseModule.update({ position: i }, { where: { id }, transaction });
  });
}

async function findManagedLesson(user, id) {
  const lesson = await Lesson.findByPk(id);
  if (!lesson) throw notFound('Lesson not found.');
  await findManagedModule(user, lesson.moduleId);
  return lesson;
}

export async function createLesson(user, moduleId, data) {
  const mod = await findManagedModule(user, moduleId);
  return sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, mod.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    const position = data.position ?? (await Lesson.count({ where: { moduleId }, transaction }));
    return Lesson.create({ ...data, moduleId, position }, { transaction });
  });
}

export async function updateLesson(user, id, data) {
  const lesson = await findManagedLesson(user, id);
  const currentModule = await CourseModule.findByPk(lesson.moduleId);
  return sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, currentModule.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    if (data.moduleId && data.moduleId !== lesson.moduleId) {
      const target = await CourseModule.findByPk(data.moduleId, { transaction });
      if (!target || target.courseId !== currentModule.courseId) throw badRequest('Lessons can only be moved between modules of the same course.');
    }
    await lesson.update(data, { transaction });
    return lesson;
  });
}

export async function deleteLesson(user, id) {
  const lesson = await findManagedLesson(user, id);
  const mod = await CourseModule.findByPk(lesson.moduleId);
  await sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, mod.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    await lesson.destroy({ transaction });
  });
}

export async function reorderLessons(user, moduleId, orderedIds) {
  const mod = await findManagedModule(user, moduleId);
  await sequelize.transaction(async (transaction) => {
    await findEditableCourse(user, mod.courseId, { transaction, lock: transaction.LOCK.UPDATE });
    const lessons = await Lesson.findAll({ where: { moduleId }, transaction });
    const ids = new Set(lessons.map((l) => l.id));
    if (orderedIds.length !== ids.size || orderedIds.some((i) => !ids.has(i))) throw badRequest('The new order must list every lesson of the module exactly once.');
    for (const [i, id] of orderedIds.entries()) await Lesson.update({ position: i }, { where: { id }, transaction });
  });
}

export async function courseEnrollments(user, courseId, { page = 1, pageSize = 20 }) {
  await findManagedCourse(user, courseId);
  const { rows, count } = await CourseEnrollment.findAndCountAll({
    where: { courseId },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['enrolledAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  const progress = {};
  for (const e of rows) progress[e.userId] = (await courseProgressFor(e.userId, [courseId]))[courseId];
  return { items: rows.map((e) => ({ ...e.toJSON(), ...(progress[e.userId] || { progress: 0 }) })), meta: pageMeta({ page, pageSize }, count) };
}

export async function completeCourseEnrollment(user, courseId, enrollmentId, { ip } = {}) {
  return sequelize.transaction(async (transaction) => {
    const course = await findManagedCourse(user, courseId, { transaction, lock: transaction.LOCK.UPDATE });
    const enrollment = await CourseEnrollment.findOne({
      where: { id: enrollmentId, courseId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!enrollment) throw notFound('Course enrollment not found.');
    if (enrollment.status === 'cancelled') throw conflict('Cancelled enrollments cannot be completed.');

    const lessons = await Lesson.findAll({
      include: [{ model: CourseModule, as: 'module', where: { courseId }, attributes: [] }],
      attributes: ['id'],
      transaction,
    });
    if (!lessons.length) throw badRequest('Add at least one lesson before completing this course enrollment.');

    const completedAt = enrollment.completedAt || new Date();
    await LessonProgress.bulkCreate(
      lessons.map((lesson) => ({
        userId: enrollment.userId,
        lessonId: lesson.id,
        courseId,
        isCompleted: true,
        completedAt,
        lastViewedAt: completedAt,
      })),
      { updateOnDuplicate: ['isCompleted', 'completedAt', 'lastViewedAt'], transaction }
    );
    const wasCompleted = enrollment.status === 'completed';
    await enrollment.update({ status: 'completed', completedAt }, { transaction });
    const learner = await User.findByPk(enrollment.userId, { transaction });
    const certificate = course.curriculumLocked ? await issueCourseCertificate(enrollment, learner, { transaction }) : null;

    if (!wasCompleted) {
      await audit({
        actorId: user.id,
        action: 'course.enrollment_completed',
        entityType: 'CourseEnrollment',
        entityId: enrollment.id,
        metadata: { courseId, certificateNumber: certificate?.certificateNumber || null },
        ip,
        transaction,
      });
    }

    return { enrollment, certificate, certificateIssued: Boolean(certificate) };
  });
}

export async function listAllEnrollments({ search, courseId, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (courseId) where.courseId = courseId;
  if (status) where.status = status;
  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: likeTerm(search) } }, { email: { [Op.iLike]: likeTerm(search) } }] } : undefined;
  const { rows, count } = await CourseEnrollment.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'], where: userWhere },
      { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
    ],
    order: [['enrolledAt', 'DESC']],
    distinct: true,
    ...toLimitOffset({ page, pageSize }),
  });
  const items = [];
  for (const e of rows) items.push({ ...e.toJSON(), ...((await courseProgressFor(e.userId, [e.courseId]))[e.courseId] || { progress: 0, totalLessons: 0, completedLessons: 0 }) });
  return { items, meta: pageMeta({ page, pageSize }, count) };
}

export async function listInstructors() {
  return User.findAll({ where: { role: ['instructor', 'admin'], accountStatus: 'active' }, attributes: ['id', 'name', 'email', 'role'], order: [['name', 'ASC']] });
}

export async function listReviewers() {
  return User.findAll({ where: { role: ['reviewer', 'admin'], accountStatus: 'active' }, attributes: ['id', 'name', 'email', 'role'], order: [['name', 'ASC']] });
}

// ---------------- Contact messages & audit ----------------

export async function listMessages({ status, search, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (search) where[Op.or] = [{ name: { [Op.iLike]: likeTerm(search) } }, { email: { [Op.iLike]: likeTerm(search) } }, { subject: { [Op.iLike]: likeTerm(search) } }];
  const { rows, count } = await ContactMessage.findAndCountAll({ where, order: [['createdAt', 'DESC']], ...toLimitOffset({ page, pageSize }) });
  return { items: rows, meta: pageMeta({ page, pageSize }, count) };
}

export async function updateMessageStatus(id, status) {
  const msg = await ContactMessage.findByPk(id);
  if (!msg) throw notFound('Message not found.');
  await msg.update({ status });
  return msg;
}

export async function listAuditLogs({ entityType, action, page = 1, pageSize = 30 }) {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = { [Op.iLike]: likeTerm(action) };
  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows, meta: pageMeta({ page, pageSize }, count) };
}

export async function listCertificates({ search, status, programId, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (search) where[Op.or] = [{ recipientName: { [Op.iLike]: likeTerm(search) } }, { certificateNumber: { [Op.iLike]: likeTerm(search) } }];
  const { rows, count } = await InternshipCertificate.findAndCountAll({
    where,
    include: [{ model: InternshipEnrollment, as: 'enrollment', attributes: ['id', 'programId', 'userId'], where: programId ? { programId } : undefined, include: [{ model: User, as: 'participant', attributes: ['id', 'email'] }] }],
    order: [['issuedAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows, meta: pageMeta({ page, pageSize }, count) };
}
