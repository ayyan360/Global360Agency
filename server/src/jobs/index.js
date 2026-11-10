import cron from 'node-cron';
import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  InternshipEnrollment,
  InternshipProgram,
  InternshipTask,
} from '../models/index.js';
import { notify } from '../services/notificationService.js';
import { evaluateEndedEnrollments } from '../services/internship/certificateService.js';
import { purgeExpiredSessions } from '../services/authService.js';
import { hasProgramStarted } from '../services/internship/scheduleService.js';
import { programPolicy } from '../services/internship/policy.js';
import { logger } from '../utils/logger.js';

const LOCK_KEY = 360360; // PostgreSQL advisory lock id so only one instance runs jobs at a time

/** approved → in_progress once the program start date is reached. */
export async function activateStartedEnrollments(now = new Date()) {
  const enrollments = await InternshipEnrollment.findAll({ where: { status: 'approved' }, include: [{ model: InternshipProgram, as: 'program' }] });
  let count = 0;
  for (const e of enrollments) {
    if (hasProgramStarted(e.program, now)) {
      await e.update({ status: 'in_progress' });
      count += 1;
    }
  }
  return count;
}

/** "New task available" — deduplicated per participant and task, so re-runs never duplicate. */
export async function notifyReleasedTasks(now = new Date()) {
  const tasks = await InternshipTask.findAll({
    where: { status: 'published', availableAt: { [Op.lte]: now, [Op.gte]: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } },
  });
  let sent = 0;
  for (const task of tasks) {
    const enrollments = await InternshipEnrollment.findAll({ where: { programId: task.programId, status: 'in_progress' }, attributes: ['id', 'userId'] });
    for (const e of enrollments) {
      const n = await notify({
        userId: e.userId,
        type: 'task_available',
        title: 'New task available',
        message: `"${task.title}" is now available. Due ${task.dueAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
        resourceType: 'InternshipTask',
        resourceId: task.id,
        link: `/student/internship/tasks/${task.id}`,
        dedupeKey: `task-available:${task.id}`,
      });
      if (n.wasCreated) sent += 1;
    }
  }
  return sent;
}

/** Deadline reminders for released tasks the participant has not submitted yet. */
export async function sendDeadlineReminders(now = new Date()) {
  const programs = await InternshipProgram.findAll({ where: { status: 'published' } });
  let sent = 0;
  for (const program of programs) {
    const hours = programPolicy(program).schedule.deadlineReminderHours;
    const tasks = await InternshipTask.findAll({
      where: { programId: program.id, status: 'published', availableAt: { [Op.lte]: now }, dueAt: { [Op.gt]: now, [Op.lte]: new Date(now.getTime() + hours * 3600 * 1000) } },
    });
    for (const task of tasks) {
      const pending = await sequelize.query(
        `SELECT e.id, e."userId" FROM internship_enrollments e
          WHERE e."programId" = :programId AND e.status = 'in_progress'
            AND NOT EXISTS (SELECT 1 FROM task_submissions s WHERE s."taskId" = :taskId AND s."enrollmentId" = e.id AND s.status <> 'superseded')`,
        { replacements: { programId: program.id, taskId: task.id }, type: QueryTypes.SELECT }
      );
      for (const e of pending) {
        await notify({
          userId: e.userId,
          type: 'deadline_reminder',
          title: 'Upcoming deadline',
          message: `"${task.title}" is due soon. Submit your work before the deadline.`,
          resourceType: 'InternshipTask',
          resourceId: task.id,
          link: `/student/internship/tasks/${task.id}`,
          dedupeKey: `deadline:${task.id}`,
        });
        sent += 1;
      }
    }
  }
  return sent;
}

export async function runAllJobs(now = new Date()) {
  // A transaction-scoped advisory lock is held on one pooled connection for the whole run,
  // so concurrent instances skip instead of duplicating work.
  return sequelize.transaction(async (transaction) => {
    const [{ locked }] = await sequelize.query('SELECT pg_try_advisory_xact_lock(:key) AS locked', { replacements: { key: LOCK_KEY }, type: QueryTypes.SELECT, transaction });
    if (!locked) return { skipped: true };
    const activated = await activateStartedEnrollments(now);
    const released = await notifyReleasedTasks(now);
    const reminders = await sendDeadlineReminders(now);
    const evaluation = await evaluateEndedEnrollments({ now });
    const purgedSessions = await purgeExpiredSessions();
    const summary = { activated, released, reminders, evaluation, purgedSessions };
    logger.info({ summary }, 'Scheduled jobs completed');
    return summary;
  });
}

let task;
export function startJobs() {
  // Every 15 minutes, plus once shortly after startup.
  task = cron.schedule('*/15 * * * *', () => runAllJobs().catch((err) => logger.error({ err }, 'Scheduled jobs failed')));
  setTimeout(() => runAllJobs().catch((err) => logger.error({ err }, 'Startup jobs failed')), 5000).unref();
  logger.info('Background jobs scheduled (every 15 minutes)');
}

export function stopJobs() {
  task?.stop();
}

