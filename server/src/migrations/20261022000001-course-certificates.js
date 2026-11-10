export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  await queryInterface.createTable('course_certificates', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
    enrollmentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'course_enrollments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
    certificateNumber: { type: DataTypes.STRING(40), allowNull: false },
    recipientName: { type: DataTypes.STRING(120), allowNull: false },
    courseTitle: { type: DataTypes.STRING(160), allowNull: false },
    completionDate: { type: DataTypes.DATE, allowNull: false },
    issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('course_certificates', ['enrollmentId'], { unique: true, name: 'course_certificates_enrollment_unique' });
  await queryInterface.addIndex('course_certificates', ['certificateNumber'], { unique: true, name: 'course_certificates_number_unique' });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('course_certificates');
}