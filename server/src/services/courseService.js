import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  Course,
  CourseModule,
  Lesson,
  User,
  Review,
  CourseEnrollment,
  LessonProgress,
  Wishlist,
} from '../models/index.js';
import { notFound } from '../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../utils/pagination.js';
import { can } from '../utils/permissions.js';

/** SQL fragments for per-course aggregates, computed in the database (never invented). */
const STAT_ATTRS = [
  [
    sequelize.literal(
      `(SELECT COUNT(*)::int FROM lessons l JOIN course_modules m ON m.id = l."moduleId" WHERE m."courseId" = "Course"."id")`
    ),
    'lessonCount',
  ],
  [
    sequelize.literal(
      `(SELECT COALESCE(SUM(l."durationSeconds"),0)::int FROM lessons l JOIN course_modules m ON m.id = l."moduleId" WHERE m."courseId" = "Course"."id")`
    ),
    'durationSeconds',
  ],
  [sequelize.literal(`(SELECT ROUND(AVG(r.rating)::numeric, 1)::float FROM reviews r WHERE r."courseId" = "Course"."id")`), 'rating'],
  [sequelize.literal(`(SELECT COUNT(*)::int FROM reviews r WHERE r."courseId" = "Course"."id")`), 'reviewCount'],
  [sequelize.literal(`(SELECT COUNT(*)::int FROM course_enrollments e WHERE e."courseId" = "Course"."id")`), 'enrollmentCount'],
];

const CARD_ATTRS = ['id', 'title', 'slug', 'shortDescription', 'thumbnailUrl', 'category', 'level', 'isFree', 'isSample', 'status', 'publishedAt', 'createdAt'];

const SORTS = {
  newest: [['publishedAt', 'DESC NULLS LAST'], ['createdAt', 'DESC']],
  popular: [[sequelize.literal('"enrollmentCount"'), 'DESC'], ['title', 'ASC']],
  rating: [[sequelize.literal('"rating"'), 'DESC NULLS LAST'], ['title', 'ASC']],
  title: [['title', 'ASC']],
};

export function serializeCourseCard(course) {
  const c = course.get({ plain: true });
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription,
    thumbnailUrl: c.thumbnailUrl,
    category: c.category,
    level: c.level,
    isFree: c.isFree,
    isSample: c.isSample,
    status: c.status,
    lessonCount: c.lessonCount ?? 0,
    durationSeconds: c.durationSeconds ?? 0,
    rating: c.rating ?? null,
    reviewCount: c.reviewCount ?? 0,
    enrollmentCount: c.enrollmentCount ?? 0,
    instructor: c.instructor ? { id: c.instructor.id, name: c.instructor.name } : null,
  };
}

export async function listCourses({ search, category, level, minRating, sort = 'newest', page = 1, pageSize = 12 }) {
  const where = { status: 'published' };
  if (search) {
    const term = likeTerm(search);
    where[Op.or] = [
      { title: { [Op.iLike]: term } },
      { shortDescription: { [Op.iLike]: term } },
      { category: { [Op.iLike]: term } },
    ];
  }
  if (category) where.category = category;
  if (level) where.level = level;
  if (minRating) {
    where[Op.and] = [
      sequelize.where(
        sequelize.literal(`(SELECT AVG(r.rating) FROM reviews r WHERE r."courseId" = "Course"."id")`),
        { [Op.gte]: minRating }
      ),
    ];
  }

  const { rows, count } = await Course.findAndCountAll({
    where,
    attributes: [...CARD_ATTRS, ...STAT_ATTRS],
    include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }],
    order: SORTS[sort] || SORTS.newest,
    distinct: true,
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows.map(serializeCourseCard), meta: pageMeta({ page, pageSize }, count) };
}

export async function listCategories() {
  return sequelize.query(
    `SELECT category AS name, COUNT(*)::int AS count FROM courses WHERE status = 'published' GROUP BY category ORDER BY category`,
    { type: QueryTypes.SELECT }
  );
}

/** Can this user see unpublished course content (admin, or the course's instructor)? */
export function canManageCourse(user, course) {
  if (!user) return false;
  if (can(user, 'courses:manage')) return true;
  return can(user, 'courses:manage-own') && course.instructorId === user.id;
}

export async function getCourseDetail(slug, user) {
  const course = await Course.findOne({
    where: { slug },
    attributes: { include: STAT_ATTRS },
    include: [
      { model: User, as: 'instructor', attributes: ['id', 'name', 'headline', 'bio', 'avatarUrl'] },
      {
        model: CourseModule,
        as: 'modules',
        include: [
          {
            model: Lesson,
            as: 'lessons',
            attributes: ['id', 'title', 'description', 'durationSeconds', 'position', 'isPreview'],
          },
        ],
      },
    ],
    order: [
      [{ model: CourseModule, as: 'modules' }, 'position', 'ASC'],
      [{ model: CourseModule, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'position', 'ASC'],
    ],
  });
  if (!course || (course.status !== 'published' && !canManageCourse(user, course))) throw notFound('Course not found.');

  const plain = course.get({ plain: true });
  const lessonIds = plain.modules.flatMap((m) => m.lessons.map((l) => l.id));

  let enrollment = null;
  let completedLessonIds = [];
  let inWishlist = false;
  let myReview = null;
  if (user) {
    enrollment = await CourseEnrollment.findOne({ where: { userId: user.id, courseId: course.id } });
    if (enrollment && lessonIds.length) {
      const done = await LessonProgress.findAll({
        where: { userId: user.id, lessonId: lessonIds, isCompleted: true },
        attributes: ['lessonId'],
      });
      completedLessonIds = done.map((d) => d.lessonId);
    }
    inWishlist = Boolean(await Wishlist.findOne({ where: { userId: user.id, courseId: course.id }, attributes: ['id'] }));
    myReview = await Review.findOne({ where: { userId: user.id, courseId: course.id } });
  }

  const reviews = await Review.findAll({
    where: { courseId: course.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl'] }],
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  const related = await Course.findAll({
    where: { status: 'published', category: course.category, id: { [Op.ne]: course.id } },
    attributes: [...CARD_ATTRS, ...STAT_ATTRS],
    include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }],
    order: [['publishedAt', 'DESC NULLS LAST']],
    limit: 3,
  });

  const firstLesson = plain.modules.find((m) => m.lessons.length)?.lessons[0] || null;
  const nextLesson =
    plain.modules.flatMap((m) => m.lessons).find((l) => !completedLessonIds.includes(l.id)) || firstLesson;

  return {
    ...serializeCourseCard(course),
    description: plain.description,
    outcomes: plain.outcomes,
    requirements: plain.requirements,
    language: plain.language,
    updatedAt: plain.updatedAt,
    instructor: plain.instructor,
    modules: plain.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      position: m.position,
      lessons: m.lessons.map((l) => ({ ...l, isCompleted: completedLessonIds.includes(l.id) })),
    })),
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, user: r.user && { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl } })),
    related: related.map(serializeCourseCard),
    viewer: {
      isEnrolled: Boolean(enrollment && enrollment.status !== 'cancelled'),
      enrollment: enrollment ? { id: enrollment.id, status: enrollment.status, enrolledAt: enrollment.enrolledAt } : null,
      completedLessons: completedLessonIds.length,
      totalLessons: lessonIds.length,
      progress: lessonIds.length ? Math.round((completedLessonIds.length / lessonIds.length) * 100) : 0,
      nextLessonId: nextLesson?.id || null,
      inWishlist,
      myReview: myReview ? { rating: myReview.rating, comment: myReview.comment } : null,
      canManage: canManageCourse(user, course),
    },
  };
}

export async function listFeatured(limit = 4) {
  const rows = await Course.findAll({
    where: { status: 'published' },
    attributes: [...CARD_ATTRS, ...STAT_ATTRS],
    include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }],
    order: SORTS.popular,
    limit,
  });
  return rows.map(serializeCourseCard);
}

export async function publicStats() {
  const [row] = await sequelize.query(
    `SELECT
       (SELECT COUNT(*)::int FROM courses WHERE status = 'published') AS "courses",
       (SELECT COUNT(DISTINCT category)::int FROM courses WHERE status = 'published') AS "categories",
       (SELECT COUNT(*)::int FROM internship_programs WHERE status = 'published') AS "internshipPrograms",
       (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND "accountStatus" = 'active') AS "learners",
       (SELECT COUNT(*)::int FROM internship_certificates WHERE status = 'valid') AS "certificatesIssued"`,
    { type: QueryTypes.SELECT }
  );
  return row;
}
