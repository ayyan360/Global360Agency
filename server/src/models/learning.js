import { DataTypes, Model } from 'sequelize';

export class Session extends Model {}
export class Course extends Model {}
export class CourseModule extends Model {}
export class Lesson extends Model {}
export class CourseEnrollment extends Model {}
export class CourseCertificate extends Model {}
export class LessonProgress extends Model {}
export class Review extends Model {}
export class Wishlist extends Model {}
export class CertificatePaymentRequest extends Model {}

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const COURSE_STATUSES = ['draft', 'published', 'archived'];

const uuidPk = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

export function initLearningModels(sequelize) {
  Session.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: DataTypes.DATE,
      userAgent: DataTypes.STRING(300),
      ip: DataTypes.STRING(64),
    },
    { sequelize, modelName: 'Session', tableName: 'sessions', updatedAt: false }
  );

  Course.init(
    {
      id: uuidPk,
      title: { type: DataTypes.STRING(160), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      shortDescription: { type: DataTypes.STRING(300), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      thumbnailUrl: DataTypes.STRING(500),
      category: { type: DataTypes.STRING(80), allowNull: false },
      level: { type: DataTypes.ENUM(...COURSE_LEVELS), allowNull: false, defaultValue: 'beginner' },
      status: { type: DataTypes.ENUM(...COURSE_STATUSES), allowNull: false, defaultValue: 'draft' },
      instructorId: DataTypes.UUID,
      outcomes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      requirements: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      language: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'English' },
      isFree: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      certificateFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isSample: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      curriculumLocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'Course', tableName: 'courses' }
  );

  CourseModule.init(
    {
      id: uuidPk,
      courseId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      description: DataTypes.TEXT,
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'CourseModule', tableName: 'course_modules' }
  );

  Lesson.init(
    {
      id: uuidPk,
      moduleId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      description: DataTypes.TEXT,
      videoUrl: DataTypes.STRING(500),
      durationSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isPreview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, modelName: 'Lesson', tableName: 'lessons' }
  );

  CourseEnrollment.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM('active', 'completed', 'cancelled'), allowNull: false, defaultValue: 'active' },
      enrolledAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      completedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'CourseEnrollment', tableName: 'course_enrollments' }
  );

  CourseCertificate.init(
    {
      id: uuidPk,
      enrollmentId: { type: DataTypes.UUID, allowNull: false, unique: true },
      certificateNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      recipientName: { type: DataTypes.STRING(120), allowNull: false },
      courseTitle: { type: DataTypes.STRING(160), allowNull: false },
      completionDate: { type: DataTypes.DATE, allowNull: false },
      issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'CourseCertificate', tableName: 'course_certificates' }
  );

  LessonProgress.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      lessonId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      isCompleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      completedAt: DataTypes.DATE,
      lastViewedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'LessonProgress', tableName: 'lesson_progress' }
  );

  Review.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
      rating: { type: DataTypes.SMALLINT, allowNull: false, validate: { min: 1, max: 5 } },
      comment: DataTypes.TEXT,
    },
    { sequelize, modelName: 'Review', tableName: 'reviews' }
  );

  Wishlist.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      courseId: { type: DataTypes.UUID, allowNull: false },
    },
    { sequelize, modelName: 'Wishlist', tableName: 'wishlists', updatedAt: false }
  );

  CertificatePaymentRequest.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      certificateType: { type: DataTypes.ENUM('course', 'internship'), allowNull: false },
      courseCertificateId: { type: DataTypes.UUID, unique: true },
      internshipCertificateId: { type: DataTypes.UUID, unique: true },
      receiptStorageKey: { type: DataTypes.STRING(500), allowNull: false },
      receiptMimeType: { type: DataTypes.STRING(80), allowNull: false },
      receiptSizeBytes: { type: DataTypes.INTEGER, allowNull: false },
      feeAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
      reviewedBy: DataTypes.UUID,
      reviewedAt: DataTypes.DATE,
      reviewNote: DataTypes.STRING(1000),
    },
    { sequelize, modelName: 'CertificatePaymentRequest', tableName: 'certificate_payment_requests' }
  );
}
