import { DataTypes, Model } from 'sequelize';

export const ROLES = ['student', 'instructor', 'reviewer', 'admin'];
export const ACCOUNT_STATUSES = ['active', 'suspended', 'deactivated'];

export class User extends Model {
  toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  }

  toPublicProfile() {
    return { id: this.id, name: this.name, avatarUrl: this.avatarUrl, headline: this.headline, bio: this.bio };
  }
}

export function initUser(sequelize) {
  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: true,
        set(v) {
          this.setDataValue('email', String(v).trim().toLowerCase());
        },
      },
      passwordHash: { type: DataTypes.STRING(100), allowNull: false },
      role: { type: DataTypes.ENUM(...ROLES), allowNull: false, defaultValue: 'student' },
      accountStatus: { type: DataTypes.ENUM(...ACCOUNT_STATUSES), allowNull: false, defaultValue: 'active' },
      avatarUrl: DataTypes.STRING(500),
      phone: DataTypes.STRING(40),
      headline: DataTypes.STRING(160),
      bio: DataTypes.TEXT,
      preferences: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      lastLoginAt: DataTypes.DATE,
      passwordChangedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'User', tableName: 'users' }
  );
  return User;
}
