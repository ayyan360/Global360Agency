const id = (DataTypes, Sequelize) => ({
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  await queryInterface.createTable('internship_task_attachments', {
    id: id(DataTypes, Sequelize),
    taskId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'internship_tasks', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    storageKey: { type: DataTypes.STRING(300), allowNull: false, unique: true },
    originalFileName: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(120), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('internship_task_attachments');
}
