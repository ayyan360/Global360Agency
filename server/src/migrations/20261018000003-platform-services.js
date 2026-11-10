/**
 * Contact messages, notifications, audit log and site settings.
 */
export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  const id = { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') };
  const createdAt = { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') };

  await queryInterface.sequelize.query(
    `CREATE TYPE enum_contact_messages_status AS ENUM ('new', 'read', 'archived');`
  );
  await queryInterface.createTable('contact_messages', {
    id,
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    subject: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: 'enum_contact_messages_status', allowNull: false, defaultValue: 'new' },
    createdAt,
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
  await queryInterface.addIndex('contact_messages', ['status', 'createdAt']);

  await queryInterface.createTable('notifications', {
    id: { ...id },
    userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    type: { type: DataTypes.STRING(60), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    resourceType: { type: DataTypes.STRING(60) },
    resourceId: { type: DataTypes.UUID },
    link: { type: DataTypes.STRING(300) },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    readAt: { type: DataTypes.DATE },
    dedupeKey: { type: DataTypes.STRING(200) },
    createdAt: { ...createdAt },
  });
  await queryInterface.addIndex('notifications', ['userId', 'isRead', 'createdAt']);
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX notifications_dedupe_unique ON notifications ("userId", "dedupeKey") WHERE "dedupeKey" IS NOT NULL;
  `);

  await queryInterface.createTable('audit_logs', {
    id: { ...id },
    actorId: { type: DataTypes.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entityType: { type: DataTypes.STRING(60), allowNull: false },
    entityId: { type: DataTypes.UUID },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ip: { type: DataTypes.STRING(64) },
    createdAt: { ...createdAt },
  });
  await queryInterface.addIndex('audit_logs', ['entityType', 'entityId']);
  await queryInterface.addIndex('audit_logs', ['createdAt']);

  await queryInterface.createTable('site_settings', {
    key: { type: DataTypes.STRING(80), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    updatedBy: { type: DataTypes.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
  });
}

export async function down({ context: { queryInterface } }) {
  for (const t of ['site_settings', 'audit_logs', 'notifications', 'contact_messages']) {
    await queryInterface.dropTable(t);
  }
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_contact_messages_status;');
}
