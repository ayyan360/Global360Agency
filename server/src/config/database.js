import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.DB_LOGGING ? (msg) => logger.debug(msg) : false,
  dialectOptions: env.DATABASE_SSL
    ? { ssl: { require: true, rejectUnauthorized: true, ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA } : {}) } }
    : {},
  timezone: '+00:00',
  define: {
    underscored: false,
    freezeTableName: false,
  },
  pool: { max: 10, min: 0, idle: 10000 },
});
