import { DataTypes, Model } from 'sequelize';

export class InternshipProgram extends Model {}
export class InternshipHoliday extends Model {}
export class InternshipApplication extends Model {
  /** Applicant-facing representation: never exposes private admin notes. */
  toApplicantJSON() {
    const v = { ...this.get({ plain: true }) };
    delete v.internalNotes;
    delete v.reviewedBy;
    return v;
  }
}
export class InternshipEnrollment extends Model {}
export class InternshipReviewerAssignment extends Model {}
export class InternshipTask extends Model {}
export class InternshipTaskAttachment extends Model {}
export class TaskSubmission extends Model {}
export class SubmissionAttachment extends Model {}
export class TaskAssessment extends Model {}
export class TaskReviewHistory extends Model {}
export class InternshipCertificate extends Model {}

export const PROGRAM_STATUSES = ['draft', 'published', 'archived'];
export const APPLICATION_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn'];
export const ENROLLMENT_STATUSES = [
  'approved',
  'in_progress',
  'completed_qualified',
  'completed_not_qualified',
  'withdrawn',
  'suspended',
];
export const TASK_STATUSES = ['draft', 'published', 'archived'];
export const SUBMISSION_STATUSES = ['submitted', 'under_review', 'revision_required', 'approved', 'rejected', 'superseded'];
export const ASSESSMENT_DECISIONS = ['approve', 'request_revision', 'reject'];

const uuidPk = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };
const decimal = (field, precision = 5) => ({
  type: DataTypes.DECIMAL(precision, 2),
  get() {
    const raw = this.getDataValue(field);
    return raw === null || raw === undefined ? raw : Number(raw);
  },
});

export function initInternshipModels(sequelize) {
  InternshipProgram.init(
    {
      id: uuidPk,
      title: { type: DataTypes.STRING(160), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      shortDescription: { type: DataTypes.STRING(300), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      track: { type: DataTypes.STRING(80), allowNull: false },
      durationMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
      durationWeeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      applicationOpenAt: DataTypes.DATE,
      applicationCloseAt: DataTypes.DATE,
      capacity: DataTypes.INTEGER,
      workingDays: { type: DataTypes.JSONB, allowNull: false, defaultValue: [1, 2, 3, 4, 5] },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
      certificateThreshold: { ...decimal('certificateThreshold'), allowNull: false, defaultValue: 70 },
      certificateFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      scoringPolicy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      scheduleConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      completionRules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      submissionConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      objectives: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      skills: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      eligibility: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      weeklyCurriculum: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      status: { type: DataTypes.ENUM(...PROGRAM_STATUSES), allowNull: false, defaultValue: 'draft' },
      isSample: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, modelName: 'InternshipProgram', tableName: 'internship_programs' }
  );

  InternshipHoliday.init(
    {
      id: uuidPk,
      programId: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
    },
    { sequelize, modelName: 'InternshipHoliday', tableName: 'internship_holidays' }
  );

  InternshipApplication.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      programId: { type: DataTypes.UUID, allowNull: false },
      fullName: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      phone: DataTypes.STRING(40),
      education: DataTypes.STRING(300),
      experience: DataTypes.TEXT,
      skills: DataTypes.TEXT,
      motivation: { type: DataTypes.TEXT, allowNull: false },
      portfolioUrl: DataTypes.STRING(500),
      status: { type: DataTypes.ENUM(...APPLICATION_STATUSES), allowNull: false, defaultValue: 'pending' },
      publicFeedback: DataTypes.TEXT,
      internalNotes: DataTypes.TEXT,
      reviewedBy: DataTypes.UUID,
      reviewedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'InternshipApplication', tableName: 'internship_applications' }
  );

  InternshipEnrollment.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      programId: { type: DataTypes.UUID, allowNull: false },
      applicationId: { type: DataTypes.UUID, allowNull: false },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.ENUM(...ENROLLMENT_STATUSES), allowNull: false, defaultValue: 'approved' },
      statusReason: DataTypes.STRING(500),
      enrolledAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      completedAt: DataTypes.DATE,
      finalScore: decimal('finalScore'),
      completionProgress: decimal('completionProgress'),
      evaluatedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'InternshipEnrollment', tableName: 'internship_enrollments' }
  );

  InternshipReviewerAssignment.init(
    {
      id: uuidPk,
      programId: { type: DataTypes.UUID, allowNull: false },
      reviewerId: { type: DataTypes.UUID, allowNull: false },
      enrollmentId: DataTypes.UUID,
      assignedBy: DataTypes.UUID,
    },
    { sequelize, modelName: 'InternshipReviewerAssignment', tableName: 'internship_reviewer_assignments' }
  );

  InternshipTask.init(
    {
      id: uuidPk,
      programId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      instructions: { type: DataTypes.TEXT, allowNull: false },
      requirements: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      acceptanceCriteria: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      skills: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      resources: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      submissionTypes: { type: DataTypes.JSONB, allowNull: false, defaultValue: ['text', 'repository', 'live', 'file'] },
      weekNumber: { type: DataTypes.INTEGER, allowNull: false },
      scheduledDay: { type: DataTypes.INTEGER, allowNull: false },
      scheduledDate: { type: DataTypes.DATEONLY, allowNull: false },
      availableAt: { type: DataTypes.DATE, allowNull: false },
      dueAt: { type: DataTypes.DATE, allowNull: false },
      maxMarks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
      isRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      status: { type: DataTypes.ENUM(...TASK_STATUSES), allowNull: false, defaultValue: 'draft' },
      createdBy: DataTypes.UUID,
    },
    { sequelize, modelName: 'InternshipTask', tableName: 'internship_tasks' }
  );

  InternshipTaskAttachment.init(
    {
      id: uuidPk,
      taskId: { type: DataTypes.UUID, allowNull: false, unique: true },
      storageKey: { type: DataTypes.STRING(300), allowNull: false, unique: true },
      originalFileName: { type: DataTypes.STRING(255), allowNull: false },
      mimeType: { type: DataTypes.STRING(120), allowNull: false },
      sizeBytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get() {
          return Number(this.getDataValue('sizeBytes'));
        },
      },
    },
    { sequelize, modelName: 'InternshipTaskAttachment', tableName: 'internship_task_attachments' }
  );

  TaskSubmission.init(
    {
      id: uuidPk,
      taskId: { type: DataTypes.UUID, allowNull: false },
      enrollmentId: { type: DataTypes.UUID, allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false },
      submissionText: DataTypes.TEXT,
      repositoryUrl: DataTypes.STRING(500),
      liveUrl: DataTypes.STRING(500),
      status: { type: DataTypes.ENUM(...SUBMISSION_STATUSES), allowNull: false, defaultValue: 'submitted' },
      isLate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'TaskSubmission', tableName: 'task_submissions' }
  );

  SubmissionAttachment.init(
    {
      id: uuidPk,
      submissionId: { type: DataTypes.UUID, allowNull: false },
      storageKey: { type: DataTypes.STRING(300), allowNull: false },
      originalFileName: { type: DataTypes.STRING(255), allowNull: false },
      mimeType: { type: DataTypes.STRING(120), allowNull: false },
      sizeBytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get() {
          return Number(this.getDataValue('sizeBytes'));
        },
      },
    },
    { sequelize, modelName: 'SubmissionAttachment', tableName: 'submission_attachments', updatedAt: false }
  );

  TaskAssessment.init(
    {
      id: uuidPk,
      submissionId: { type: DataTypes.UUID, allowNull: false },
      reviewerId: { type: DataTypes.UUID, allowNull: false },
      marksAwarded: decimal('marksAwarded', 7),
      feedback: { type: DataTypes.TEXT, allowNull: false },
      decision: { type: DataTypes.ENUM(...ASSESSMENT_DECISIONS), allowNull: false },
      isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      assessedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      supersededAt: DataTypes.DATE,
      supersededById: DataTypes.UUID,
      amendmentReason: DataTypes.TEXT,
    },
    { sequelize, modelName: 'TaskAssessment', tableName: 'task_assessments', updatedAt: false }
  );

  TaskReviewHistory.init(
    {
      id: uuidPk,
      submissionId: { type: DataTypes.UUID, allowNull: false },
      reviewerId: DataTypes.UUID,
      previousStatus: DataTypes.STRING(40),
      newStatus: { type: DataTypes.STRING(40), allowNull: false },
      action: { type: DataTypes.STRING(60), allowNull: false },
      feedback: DataTypes.TEXT,
    },
    { sequelize, modelName: 'TaskReviewHistory', tableName: 'task_review_history', updatedAt: false }
  );

  InternshipCertificate.init(
    {
      id: uuidPk,
      enrollmentId: { type: DataTypes.UUID, allowNull: false, unique: true },
      certificateNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      recipientName: { type: DataTypes.STRING(120), allowNull: false },
      programTitle: { type: DataTypes.STRING(160), allowNull: false },
      track: { type: DataTypes.STRING(80), allowNull: false },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      completionDate: { type: DataTypes.DATEONLY, allowNull: false },
      finalScore: { ...decimal('finalScore'), allowNull: false },
      issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      pdfStorageKey: DataTypes.STRING(300),
      status: { type: DataTypes.ENUM('valid', 'revoked'), allowNull: false, defaultValue: 'valid' },
      revokedAt: DataTypes.DATE,
      revokedBy: DataTypes.UUID,
      revocationReason: DataTypes.TEXT,
    },
    { sequelize, modelName: 'InternshipCertificate', tableName: 'internship_certificates' }
  );
}
