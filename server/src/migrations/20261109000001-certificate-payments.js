export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  await queryInterface.addColumn('courses', 'certificateFee', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.addColumn('internship_programs', 'certificateFee', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.sequelize.query(`
    CREATE TYPE enum_certificate_payment_requests_certificateType AS ENUM ('course', 'internship');
    CREATE TYPE enum_certificate_payment_requests_status AS ENUM ('pending', 'approved', 'rejected');
  `);
  await queryInterface.createTable('certificate_payment_requests', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
    certificateType: { type: 'enum_certificate_payment_requests_certificateType', allowNull: false },
    courseCertificateId: { type: DataTypes.UUID, references: { model: 'course_certificates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
    internshipCertificateId: { type: DataTypes.UUID, references: { model: 'internship_certificates', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
    receiptStorageKey: { type: DataTypes.STRING(500), allowNull: false },
    receiptMimeType: { type: DataTypes.STRING(80), allowNull: false },
    receiptSizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: 'enum_certificate_payment_requests_status', allowNull: false, defaultValue: 'pending' },
    reviewedBy: { type: DataTypes.UUID, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
    reviewedAt: { type: DataTypes.DATE },
    reviewNote: { type: DataTypes.STRING(1000) },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('certificate_payment_requests', ['courseCertificateId'], { unique: true, name: 'certificate_payment_course_unique' });
  await queryInterface.addIndex('certificate_payment_requests', ['internshipCertificateId'], { unique: true, name: 'certificate_payment_internship_unique' });
  await queryInterface.addIndex('certificate_payment_requests', ['status', 'createdAt'], { name: 'certificate_payment_status_created_idx' });
  await queryInterface.sequelize.query(`
    ALTER TABLE courses ADD CONSTRAINT courses_certificate_fee_nonnegative CHECK ("certificateFee" >= 0);
    ALTER TABLE internship_programs ADD CONSTRAINT internship_programs_certificate_fee_nonnegative CHECK ("certificateFee" >= 0);
    ALTER TABLE certificate_payment_requests ADD CONSTRAINT certificate_payment_request_target_check CHECK (
      ("certificateType" = 'course' AND "courseCertificateId" IS NOT NULL AND "internshipCertificateId" IS NULL)
      OR ("certificateType" = 'internship' AND "internshipCertificateId" IS NOT NULL AND "courseCertificateId" IS NULL)
    );
    ALTER TABLE certificate_payment_requests ADD CONSTRAINT certificate_payment_receipt_size_check CHECK ("receiptSizeBytes" > 0);
  `);
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('certificate_payment_requests');
  await queryInterface.sequelize.query(`
    DROP TYPE enum_certificate_payment_requests_status;
    DROP TYPE enum_certificate_payment_requests_certificateType;
  `);
  await queryInterface.removeColumn('internship_programs', 'certificateFee');
  await queryInterface.removeColumn('courses', 'certificateFee');
}
