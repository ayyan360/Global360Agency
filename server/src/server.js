import { env } from './config/env.js';
import { createApp } from './app.js';
import { sequelize } from './models/index.js';
import { createMigrator } from './config/migrator.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    await sequelize.authenticate();
  } catch (err) {
    logger.fatal({ err: err.message }, 'Cannot connect to PostgreSQL. Check DATABASE_URL and that the database server is running.');
    process.exit(1);
  }
  const pending = await createMigrator({ logger: undefined }).pending();
  if (pending.length) {
    logger.warn(`There are ${pending.length} pending migration(s). Run "npm run db:migrate" before using the app.`);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`Global360 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
  if (env.ENABLE_JOBS) startJobs();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    stopJobs();
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
