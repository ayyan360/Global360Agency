import { sequelize } from '../config/database.js';
import { User, initUser } from './User.js';
import {
  Session,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  CourseCertificate,
  LessonProgress,
  Review,
  Wishlist,
  CertificatePaymentRequest,
  initLearningModels,
} from './learning.js';
import {
  InternshipProgram,
  InternshipHoliday,
  InternshipApplication,
  InternshipEnrollment,
  InternshipReviewerAssignment,
  InternshipTask,
  InternshipTaskAttachment,
  TaskSubmission,
  SubmissionAttachment,
  TaskAssessment,
  TaskReviewHistory,
  InternshipCertificate,
  initInternshipModels,
} from './internship.js';
import { ContactMessage, Notification, AuditLog, SiteSetting, initPlatformModels } from './platform.js';

initUser(sequelize);
initLearningModels(sequelize);
initInternshipModels(sequelize);
initPlatformModels(sequelize);

// ---- Learning associations ----
User.hasMany(Session, { foreignKey: 'userId' });
Session.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Course, { foreignKey: 'instructorId', as: 'taughtCourses' });
Course.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

Course.hasMany(CourseModule, { foreignKey: 'courseId', as: 'modules' });
CourseModule.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

CourseModule.hasMany(Lesson, { foreignKey: 'moduleId', as: 'lessons' });
Lesson.belongsTo(CourseModule, { foreignKey: 'moduleId', as: 'module' });

User.hasMany(CourseEnrollment, { foreignKey: 'userId', as: 'courseEnrollments' });
CourseEnrollment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Course.hasMany(CourseEnrollment, { foreignKey: 'courseId', as: 'enrollments' });
CourseEnrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
CourseEnrollment.hasOne(CourseCertificate, { foreignKey: 'enrollmentId', as: 'certificate' });
CourseCertificate.belongsTo(CourseEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });
CertificatePaymentRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
CertificatePaymentRequest.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });
CertificatePaymentRequest.belongsTo(CourseCertificate, { foreignKey: 'courseCertificateId', as: 'courseCertificate' });
CertificatePaymentRequest.belongsTo(InternshipCertificate, { foreignKey: 'internshipCertificateId', as: 'internshipCertificate' });

LessonProgress.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
LessonProgress.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
LessonProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(Review, { foreignKey: 'courseId', as: 'reviews' });
Review.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Wishlist.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ---- Internship associations ----
InternshipProgram.hasMany(InternshipHoliday, { foreignKey: 'programId', as: 'holidays' });
InternshipHoliday.belongsTo(InternshipProgram, { foreignKey: 'programId', as: 'program' });

InternshipProgram.hasMany(InternshipApplication, { foreignKey: 'programId', as: 'applications' });
InternshipApplication.belongsTo(InternshipProgram, { foreignKey: 'programId', as: 'program' });
InternshipApplication.belongsTo(User, { foreignKey: 'userId', as: 'applicant' });
InternshipApplication.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });
User.hasMany(InternshipApplication, { foreignKey: 'userId', as: 'internshipApplications' });

InternshipProgram.hasMany(InternshipEnrollment, { foreignKey: 'programId', as: 'enrollments' });
InternshipEnrollment.belongsTo(InternshipProgram, { foreignKey: 'programId', as: 'program' });
InternshipEnrollment.belongsTo(User, { foreignKey: 'userId', as: 'participant' });
InternshipEnrollment.belongsTo(InternshipApplication, { foreignKey: 'applicationId', as: 'application' });
User.hasMany(InternshipEnrollment, { foreignKey: 'userId', as: 'internshipEnrollments' });

InternshipProgram.hasMany(InternshipReviewerAssignment, { foreignKey: 'programId', as: 'reviewerAssignments' });
InternshipReviewerAssignment.belongsTo(InternshipProgram, { foreignKey: 'programId', as: 'program' });
InternshipReviewerAssignment.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
InternshipReviewerAssignment.belongsTo(InternshipEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

InternshipProgram.hasMany(InternshipTask, { foreignKey: 'programId', as: 'tasks' });
InternshipTask.belongsTo(InternshipProgram, { foreignKey: 'programId', as: 'program' });
InternshipTask.hasOne(InternshipTaskAttachment, { foreignKey: 'taskId', as: 'attachment', onDelete: 'CASCADE' });
InternshipTaskAttachment.belongsTo(InternshipTask, { foreignKey: 'taskId', as: 'task' });

InternshipTask.hasMany(TaskSubmission, { foreignKey: 'taskId', as: 'submissions' });
TaskSubmission.belongsTo(InternshipTask, { foreignKey: 'taskId', as: 'task' });
InternshipEnrollment.hasMany(TaskSubmission, { foreignKey: 'enrollmentId', as: 'submissions' });
TaskSubmission.belongsTo(InternshipEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

TaskSubmission.hasMany(SubmissionAttachment, { foreignKey: 'submissionId', as: 'attachments' });
SubmissionAttachment.belongsTo(TaskSubmission, { foreignKey: 'submissionId', as: 'submission' });

TaskSubmission.hasMany(TaskAssessment, { foreignKey: 'submissionId', as: 'assessments' });
TaskAssessment.belongsTo(TaskSubmission, { foreignKey: 'submissionId', as: 'submission' });
TaskAssessment.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });

TaskSubmission.hasMany(TaskReviewHistory, { foreignKey: 'submissionId', as: 'history' });
TaskReviewHistory.belongsTo(TaskSubmission, { foreignKey: 'submissionId', as: 'submission' });
TaskReviewHistory.belongsTo(User, { foreignKey: 'reviewerId', as: 'actor' });

InternshipEnrollment.hasOne(InternshipCertificate, { foreignKey: 'enrollmentId', as: 'certificate' });
InternshipCertificate.belongsTo(InternshipEnrollment, { foreignKey: 'enrollmentId', as: 'enrollment' });

// ---- Platform associations ----
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

export {
  sequelize,
  User,
  Session,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  CourseCertificate,
  LessonProgress,
  Review,
  Wishlist,
  CertificatePaymentRequest,
  InternshipProgram,
  InternshipHoliday,
  InternshipApplication,
  InternshipEnrollment,
  InternshipReviewerAssignment,
  InternshipTask,
  InternshipTaskAttachment,
  TaskSubmission,
  SubmissionAttachment,
  TaskAssessment,
  TaskReviewHistory,
  InternshipCertificate,
  ContactMessage,
  Notification,
  AuditLog,
  SiteSetting,
};
