/**
 * Internship programs, applications, enrollments, tasks, submissions,
 * assessments, reviewer assignments, holidays and certificates.
 */
const id = (DataTypes, Sequelize) => ({
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});
const timestamps = (DataTypes, Sequelize) => ({
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
});
const fk = (DataTypes, table, { allowNull = false, onDelete = 'CASCADE' } = {}) => ({
  type: DataTypes.UUID,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  const q = (sql) => queryInterface.sequelize.query(sql);

  await q(`
    CREATE TYPE enum_internship_programs_status AS ENUM ('draft', 'published', 'archived');
    CREATE TYPE enum_internship_applications_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'waitlisted', 'withdrawn');
    CREATE TYPE enum_internship_enrollments_status AS ENUM ('approved', 'in_progress', 'completed_qualified', 'completed_not_qualified', 'withdrawn', 'suspended');
    CREATE TYPE enum_internship_tasks_status AS ENUM ('draft', 'published', 'archived');
    CREATE TYPE enum_task_submissions_status AS ENUM ('submitted', 'under_review', 'revision_required', 'approved', 'rejected', 'superseded');
    CREATE TYPE enum_task_assessments_decision AS ENUM ('approve', 'request_revision', 'reject');
    CREATE TYPE enum_internship_certificates_status AS ENUM ('valid', 'revoked');
  `);

  await queryInterface.createTable('internship_programs', {
    id: id(DataTypes, Sequelize),
    title: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false },
    shortDescription: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    track: { type: DataTypes.STRING(80), allowNull: false },
    durationMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    durationWeeks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    applicationOpenAt: { type: DataTypes.DATE },
    applicationCloseAt: { type: DataTypes.DATE },
    capacity: { type: DataTypes.INTEGER },
    workingDays: { type: DataTypes.JSONB, allowNull: false, defaultValue: [1, 2, 3, 4, 5] },
    timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
    certificateThreshold: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 70 },
    scoringPolicy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    scheduleConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    completionRules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    submissionConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    objectives: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    skills: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    eligibility: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    weeklyCurriculum: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    status: { type: 'enum_internship_programs_status', allowNull: false, defaultValue: 'draft' },
    isSample: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_programs', ['slug'], { unique: true, name: 'internship_programs_slug_unique' });
  await queryInterface.addIndex('internship_programs', ['status', 'track']);
  await q(`
    ALTER TABLE internship_programs
      ADD CONSTRAINT internship_programs_dates CHECK ("endDate" > "startDate"),
      ADD CONSTRAINT internship_programs_threshold CHECK ("certificateThreshold" >= 0 AND "certificateThreshold" <= 100),
      ADD CONSTRAINT internship_programs_capacity CHECK (capacity IS NULL OR capacity > 0);
  `);

  await queryInterface.createTable('internship_holidays', {
    id: id(DataTypes, Sequelize),
    programId: fk(DataTypes, 'internship_programs'),
    date: { type: DataTypes.DATEONLY, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_holidays', ['programId', 'date'], {
    unique: true,
    name: 'internship_holidays_program_date_unique',
  });

  await queryInterface.createTable('internship_applications', {
    id: id(DataTypes, Sequelize),
    userId: fk(DataTypes, 'users'),
    programId: fk(DataTypes, 'internship_programs', { onDelete: 'RESTRICT' }),
    fullName: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    phone: { type: DataTypes.STRING(40) },
    education: { type: DataTypes.STRING(300) },
    experience: { type: DataTypes.TEXT },
    skills: { type: DataTypes.TEXT },
    motivation: { type: DataTypes.TEXT, allowNull: false },
    portfolioUrl: { type: DataTypes.STRING(500) },
    status: { type: 'enum_internship_applications_status', allowNull: false, defaultValue: 'pending' },
    publicFeedback: { type: DataTypes.TEXT },
    internalNotes: { type: DataTypes.TEXT },
    reviewedBy: fk(DataTypes, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    reviewedAt: { type: DataTypes.DATE },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_applications', ['programId', 'status']);
  await queryInterface.addIndex('internship_applications', ['userId']);
  // Only one active (non-final) application per user and program.
  await q(`
    CREATE UNIQUE INDEX internship_applications_active_unique
      ON internship_applications ("userId", "programId")
      WHERE status IN ('pending', 'under_review', 'approved', 'waitlisted');
  `);

  await queryInterface.createTable('internship_enrollments', {
    id: id(DataTypes, Sequelize),
    userId: fk(DataTypes, 'users', { onDelete: 'RESTRICT' }),
    programId: fk(DataTypes, 'internship_programs', { onDelete: 'RESTRICT' }),
    applicationId: fk(DataTypes, 'internship_applications', { onDelete: 'RESTRICT' }),
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: 'enum_internship_enrollments_status', allowNull: false, defaultValue: 'approved' },
    statusReason: { type: DataTypes.STRING(500) },
    enrolledAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    completedAt: { type: DataTypes.DATE },
    finalScore: { type: DataTypes.DECIMAL(5, 2) },
    completionProgress: { type: DataTypes.DECIMAL(5, 2) },
    evaluatedAt: { type: DataTypes.DATE },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_enrollments', ['userId', 'programId'], {
    unique: true,
    name: 'internship_enrollments_user_program_unique',
  });
  await queryInterface.addIndex('internship_enrollments', ['applicationId'], {
    unique: true,
    name: 'internship_enrollments_application_unique',
  });
  await queryInterface.addIndex('internship_enrollments', ['programId', 'status']);

  await queryInterface.createTable('internship_reviewer_assignments', {
    id: id(DataTypes, Sequelize),
    programId: fk(DataTypes, 'internship_programs'),
    reviewerId: fk(DataTypes, 'users'),
    enrollmentId: fk(DataTypes, 'internship_enrollments', { allowNull: true }),
    assignedBy: fk(DataTypes, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    ...timestamps(DataTypes, Sequelize),
  });
  // enrollmentId NULL means "whole program"; NULLS NOT DISTINCT prevents duplicate program-wide assignments.
  await q(`
    CREATE UNIQUE INDEX internship_reviewer_assignments_unique
      ON internship_reviewer_assignments ("programId", "reviewerId", "enrollmentId") NULLS NOT DISTINCT;
  `);
  await queryInterface.addIndex('internship_reviewer_assignments', ['reviewerId']);

  await queryInterface.createTable('internship_tasks', {
    id: id(DataTypes, Sequelize),
    programId: fk(DataTypes, 'internship_programs'),
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
    status: { type: 'enum_internship_tasks_status', allowNull: false, defaultValue: 'draft' },
    createdBy: fk(DataTypes, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_tasks', ['programId', 'scheduledDate']);
  await queryInterface.addIndex('internship_tasks', ['programId', 'status']);
  await q(`
    ALTER TABLE internship_tasks
      ADD CONSTRAINT internship_tasks_max_marks CHECK ("maxMarks" > 0),
      ADD CONSTRAINT internship_tasks_due_after_available CHECK ("dueAt" > "availableAt"),
      ADD CONSTRAINT internship_tasks_weekday CHECK ("scheduledDay" BETWEEN 1 AND 7);
  `);

  await queryInterface.createTable('task_submissions', {
    id: id(DataTypes, Sequelize),
    taskId: fk(DataTypes, 'internship_tasks', { onDelete: 'RESTRICT' }),
    enrollmentId: fk(DataTypes, 'internship_enrollments', { onDelete: 'RESTRICT' }),
    version: { type: DataTypes.INTEGER, allowNull: false },
    submissionText: { type: DataTypes.TEXT },
    repositoryUrl: { type: DataTypes.STRING(500) },
    liveUrl: { type: DataTypes.STRING(500) },
    status: { type: 'enum_task_submissions_status', allowNull: false, defaultValue: 'submitted' },
    isLate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('task_submissions', ['taskId', 'enrollmentId', 'version'], {
    unique: true,
    name: 'task_submissions_version_unique',
  });
  await queryInterface.addIndex('task_submissions', ['status', 'submittedAt']);
  await queryInterface.addIndex('task_submissions', ['enrollmentId']);

  await queryInterface.createTable('submission_attachments', {
    id: id(DataTypes, Sequelize),
    submissionId: fk(DataTypes, 'task_submissions'),
    storageKey: { type: DataTypes.STRING(300), allowNull: false },
    originalFileName: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(120), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('submission_attachments', ['submissionId']);
  await queryInterface.addIndex('submission_attachments', ['storageKey'], { unique: true, name: 'submission_attachments_key_unique' });

  await queryInterface.createTable('task_assessments', {
    id: id(DataTypes, Sequelize),
    submissionId: fk(DataTypes, 'task_submissions', { onDelete: 'RESTRICT' }),
    reviewerId: fk(DataTypes, 'users', { onDelete: 'RESTRICT' }),
    marksAwarded: { type: DataTypes.DECIMAL(7, 2) },
    feedback: { type: DataTypes.TEXT, allowNull: false },
    decision: { type: 'enum_task_assessments_decision', allowNull: false },
    isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    assessedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    supersededAt: { type: DataTypes.DATE },
    supersededById: { type: DataTypes.UUID },
    amendmentReason: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('task_assessments', ['submissionId']);
  // At most one current finalized assessment per submission.
  await q(`
    CREATE UNIQUE INDEX task_assessments_one_current_final
      ON task_assessments ("submissionId")
      WHERE "isFinal" = true AND "supersededAt" IS NULL;
    ALTER TABLE task_assessments
      ADD CONSTRAINT task_assessments_marks_nonnegative CHECK ("marksAwarded" IS NULL OR "marksAwarded" >= 0),
      ADD CONSTRAINT task_assessments_final_has_marks CHECK ("isFinal" = false OR "marksAwarded" IS NOT NULL);
  `);

  await queryInterface.createTable('task_review_history', {
    id: id(DataTypes, Sequelize),
    submissionId: fk(DataTypes, 'task_submissions', { onDelete: 'RESTRICT' }),
    reviewerId: fk(DataTypes, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    previousStatus: { type: DataTypes.STRING(40) },
    newStatus: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.STRING(60), allowNull: false },
    feedback: { type: DataTypes.TEXT },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('task_review_history', ['submissionId', 'createdAt']);

  await queryInterface.createTable('internship_certificates', {
    id: id(DataTypes, Sequelize),
    enrollmentId: fk(DataTypes, 'internship_enrollments', { onDelete: 'RESTRICT' }),
    certificateNumber: { type: DataTypes.STRING(40), allowNull: false },
    recipientName: { type: DataTypes.STRING(120), allowNull: false },
    programTitle: { type: DataTypes.STRING(160), allowNull: false },
    track: { type: DataTypes.STRING(80), allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    completionDate: { type: DataTypes.DATEONLY, allowNull: false },
    finalScore: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    pdfStorageKey: { type: DataTypes.STRING(300) },
    status: { type: 'enum_internship_certificates_status', allowNull: false, defaultValue: 'valid' },
    revokedAt: { type: DataTypes.DATE },
    revokedBy: fk(DataTypes, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    revocationReason: { type: DataTypes.TEXT },
    ...timestamps(DataTypes, Sequelize),
  });
  await queryInterface.addIndex('internship_certificates', ['enrollmentId'], {
    unique: true,
    name: 'internship_certificates_enrollment_unique',
  });
  await queryInterface.addIndex('internship_certificates', ['certificateNumber'], {
    unique: true,
    name: 'internship_certificates_number_unique',
  });
}

export async function down({ context: { queryInterface } }) {
  for (const t of [
    'internship_certificates',
    'task_review_history',
    'task_assessments',
    'submission_attachments',
    'task_submissions',
    'internship_tasks',
    'internship_reviewer_assignments',
    'internship_enrollments',
    'internship_applications',
    'internship_holidays',
    'internship_programs',
  ]) {
    await queryInterface.dropTable(t);
  }
  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS enum_internship_certificates_status;
    DROP TYPE IF EXISTS enum_task_assessments_decision;
    DROP TYPE IF EXISTS enum_task_submissions_status;
    DROP TYPE IF EXISTS enum_internship_tasks_status;
    DROP TYPE IF EXISTS enum_internship_enrollments_status;
    DROP TYPE IF EXISTS enum_internship_applications_status;
    DROP TYPE IF EXISTS enum_internship_programs_status;
  `);
}
