import { DataTypes, Model } from 'sequelize';

export class ContactMessage extends Model {}
export class Notification extends Model {}
export class AuditLog extends Model {}
export class SiteSetting extends Model {}

const uuidPk = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

export function initPlatformModels(sequelize) {
  ContactMessage.init(
    {
      id: uuidPk,
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      subject: { type: DataTypes.STRING(200), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.ENUM('new', 'read', 'archived'), allowNull: false, defaultValue: 'new' },
    },
    { sequelize, modelName: 'ContactMessage', tableName: 'contact_messages' }
  );

  Notification.init(
    {
      id: uuidPk,
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING(60), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      resourceType: DataTypes.STRING(60),
      resourceId: DataTypes.UUID,
      link: DataTypes.STRING(300),
      isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      readAt: DataTypes.DATE,
      dedupeKey: DataTypes.STRING(200),
    },
    { sequelize, modelName: 'Notification', tableName: 'notifications', updatedAt: false }
  );

  AuditLog.init(
    {
      id: uuidPk,
      actorId: DataTypes.UUID,
      action: { type: DataTypes.STRING(80), allowNull: false },
      entityType: { type: DataTypes.STRING(60), allowNull: false },
      entityId: DataTypes.UUID,
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      ip: DataTypes.STRING(64),
    },
    { sequelize, modelName: 'AuditLog', tableName: 'audit_logs', updatedAt: false }
  );

  SiteSetting.init(
    {
      key: { type: DataTypes.STRING(80), primaryKey: true },
      value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      updatedBy: DataTypes.UUID,
    },
    { sequelize, modelName: 'SiteSetting', tableName: 'site_settings', createdAt: false }
  );
}
