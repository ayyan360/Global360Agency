import { sequelize } from '../models/index.js';
import { seedCourses, seedPrograms, seedDemo } from '../seeders/index.js';
import { env } from '../config/env.js';

/**
 * Development seeder. Safe to run repeatedly: existing records (matched by slug/email) are left alone.
 *   npm run db:seed              → sample courses, sample instructors, internship programs and tasks
 *   npm run db:seed -- --demo    → also demo student/graduate/reviewer accounts and activity
 *                                  (requires DEMO_USER_PASSWORD; never used in production)
 */
const withDemo = process.argv.includes('--demo');

try {
  if (env.isProd && !process.argv.includes('--allow-production')) {
    throw new Error('Refusing to seed sample content in production. Pass --allow-production if you really intend to.');
  }
  await seedCourses();
  const programs = await seedPrograms();
  if (withDemo) {
    if (env.isProd) throw new Error('Demo accounts are never created in production.');
    const password = process.env.DEMO_USER_PASSWORD;
    if (!password || password.length < 10) {
      throw new Error('Set DEMO_USER_PASSWORD (at least 10 characters) to create demo accounts, e.g. DEMO_USER_PASSWORD="choose-a-password" npm run db:seed -- --demo');
    }
    await seedDemo(programs, password);
  }
  console.log('Seeding complete.');
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
