import { sequelize } from '../config/database.js';
import { runAllJobs } from '../jobs/index.js';

// Run all scheduled jobs once (useful with an external scheduler such as a platform cron).
try {
  const summary = await runAllJobs();
  console.log(JSON.stringify(summary, null, 2));
} catch (err) {
  console.error('Jobs failed:', err);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
