import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsGlob = path.join(__dirname, '../migrations/*.js').replace(/\\/g, '/');

/**
 * Sequelize migrations driven by Umzug (the migration engine behind sequelize-cli),
 * which supports native ES modules. Applied migrations are tracked in "SequelizeMeta".
 */
export function createMigrator({ logger = console } = {}) {
  return new Umzug({
    migrations: {
      glob: migrationsGlob,
      resolve: ({ name, path: filePath, context }) => ({
        name,
        up: async () => (await import(pathToFileURL(filePath).href)).up({ context }),
        down: async () => (await import(pathToFileURL(filePath).href)).down({ context }),
      }),
    },
    context: { queryInterface: sequelize.getQueryInterface(), Sequelize },
    storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
    logger,
  });
}
