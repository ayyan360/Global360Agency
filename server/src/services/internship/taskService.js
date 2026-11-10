import { Op } from 'sequelize';
import {
  sequelize,
  InternshipProgram,
  InternshipTask,
  InternshipEnrollment,
  TaskSubmission,
} from '../../models/index.js';
import { notFound, badRequest, conflict, forbidden } from '../../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../../utils/pagination.js';
import { audit } from '../auditService.js';
import { notify } from '../notificationService.js';
import { programPolicy } from './policy.js';
import {
  programDays,
  computeTaskTimes,
  dateForWeekDay,
  weekCalendar,
  currentWeekNumber,
  totalWeeks,
  hasProgramStarted,
  hasProgramEnded,
  programBounds,
  todayInProgram,
} from './scheduleService.js';
import { loadHolidays, participantTaskState } from './scoringService.js';

const TASK_FIELDS = ['title', 'description', 'instructions', 'requirements', 'acceptanceCriteria', 'skills', 'resources', 'submissionTypes', 'maxMarks', 'isRequired'];

/**
 * Resolves the scheduled working date for a task from either an explicit date or (weekNumber, weekday),
 * rejecting weekends/days off, holidays and dates outside the program unless an admin explicitly
 * allows an exception.
 */
async function resolveSchedule(program, { scheduledDate, weekNumber, scheduledDay, allowNonWorkingDay }, transaction) {
  const holidays = await loadHolidays(program.id, transaction);
  let day;
  if (scheduledDate) {
    day = programDays(program, holidays).find((d) => d.date === scheduledDate);
  } else if (weekNumber && scheduledDay) {
    day = dateForWeekDay(program, weekNumber, scheduledDay, holidays);
  } else {
    throw badRequest('Provide a scheduled date, or a week number and weekday.');
  }
  if (!day) throw badRequest('The scheduled date is outside the program dates.');
  if (!day.isWorkingDay && !allowNonWorkingDay) {
    throw badRequest(
      day.dayType === 'holiday'
        ? `${day.date} is a program holiday (${day.holidayName}). Choose a working day or explicitly allow an exception.`
        : `${day.date} is a ${day.weekdayName}, which is a day off for this program. Choose a working day or explicitly allow an exception.`,
      { code: 'NON_WORKING_DAY' }
    );
  }
  return day;
}

export function serializeTask(task) {
  const t = task.get ? task.get({ plain: true }) : task;
  return {
    id: t.id,
    programId: t.programId,
    title: t.title,
    description: t.description,
    instructions: t.instructions,
    requirements: t.requirements,
    acceptanceCriteria: t.acceptanceCriteria,
    skills: t.skills,
    resources: t.resources,
    submissionTypes: t.submissionTypes,
    weekNumber: t.weekNumber,
    scheduledDay: t.scheduledDay,
    scheduledDate: t.scheduledDate,
    availableAt: t.availableAt,
    dueAt: t.dueAt,
    maxMarks: t.maxMarks,
    isRequired: t.isRequired,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ---------------- Admin ----------------

export async function adminListTasks({ programId, status, week, search, page = 1, pageSize = 50 }) {
  const where = {};
  if (programId) where.programId = programId;
  if (status) where.status = status;
  if (week) where.weekNumber = week;
  if (search) where.title = { [Op.iLike]: likeTerm(search) };
  const { rows, count } = await InternshipTask.findAndCountAll({
    where,
    attributes: {
      include: [[sequelize.literal(`(SELECT COUNT(DISTINCT s."enrollmentId")::int FROM task_submissions s WHERE s."taskId" = "InternshipTask"."id")`), 'submissionCount']],
    },
    include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track', 'timezone'] }],
    order: [['scheduledDate', 'ASC'], ['availableAt', 'ASC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return {
    items: rows.map((t) => ({ ...serializeTask(t), program: t.program, submissionCount: t.get('submissionCount') })),
    meta: pageMeta({ page, pageSize }, count),
  };
}

export async function adminGetTask(id) {
  const task = await InternshipTask.findByPk(id, { include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track', 'timezone', 'startDate', 'endDate'] }] });
  if (!task) throw notFound('Task not found.');
  return { ...serializeTask(task), program: task.program };
}

export async function createTask(admin, programId, data, { ip } = {}) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  const day = await resolveSchedule(program, data);
  const times = computeTaskTimes(program, day.date, { availableAt: data.availableAt, dueAt: data.dueAt });
  if (times.dueAt <= times.availableAt) throw badRequest('The due time must be after the release time.');
  const task = await InternshipTask.create({
    ...Object.fromEntries(TASK_FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]])),
    programId,
    weekNumber: day.weekNumber,
    scheduledDay: day.weekday,
    scheduledDate: day.date,
    availableAt: times.availableAt,
    dueAt: times.dueAt,
    status: data.status === 'published' ? 'published' : 'draft',
    createdBy: admin.id,
  });
  await audit({ actorId: admin.id, action: 'task.created', entityType: 'InternshipTask', entityId: task.id, metadata: { programId, scheduledDate: day.date, status: task.status }, ip });
  return serializeTask(task);
}

/**
 * Historical deadlines are never changed silently: once a published task has been released,
 * changing its schedule or marks requires a reason, is audited, and participants are notified.
 */
export async function updateTask(admin, id, data, { ip } = {}) {
  const task = await InternshipTask.findByPk(id);
  if (!task) throw notFound('Task not found.');
  const program = await InternshipProgram.findByPk(task.programId);
  const updates = Object.fromEntries(TASK_FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]]));

  const scheduleTouched = ['scheduledDate', 'weekNumber', 'scheduledDay', 'availableAt', 'dueAt'].some((k) => data[k] !== undefined);
  if (scheduleTouched) {
    const day = await resolveSchedule(program, {
      scheduledDate: data.scheduledDate || (data.weekNumber || data.scheduledDay ? undefined : task.scheduledDate),
      weekNumber: data.weekNumber || task.weekNumber,
      scheduledDay: data.scheduledDay || task.scheduledDay,
      allowNonWorkingDay: data.allowNonWorkingDay,
    });
    const times = computeTaskTimes(program, day.date, { availableAt: data.availableAt, dueAt: data.dueAt });
    if (times.dueAt <= times.availableAt) throw badRequest('The due time must be after the release time.');
    Object.assign(updates, { weekNumber: day.weekNumber, scheduledDay: day.weekday, scheduledDate: day.date, availableAt: times.availableAt, dueAt: times.dueAt });
  }

  const released = task.status === 'published' && new Date(task.availableAt) <= new Date();
  const deadlineChanged = updates.dueAt && new Date(updates.dueAt).getTime() !== new Date(task.dueAt).getTime();
  const marksChanged = updates.maxMarks !== undefined && updates.maxMarks !== task.maxMarks;
  const requiredChanged = updates.isRequired !== undefined && updates.isRequired !== task.isRequired;
  if (released && (deadlineChanged || marksChanged || requiredChanged || updates.availableAt)) {
    if (!data.changeReason || data.changeReason.trim().length < 5) {
      throw badRequest('This task has already been released. Provide a reason for changing its schedule, marks or required status.', { code: 'CHANGE_REASON_REQUIRED' });
    }
    if (marksChanged) {
      const [{ maxAwarded }] = await sequelize.query(
        `SELECT COALESCE(MAX(a."marksAwarded"),0)::float AS "maxAwarded" FROM task_assessments a JOIN task_submissions s ON s.id = a."submissionId" WHERE s."taskId" = :id AND a."supersededAt" IS NULL`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );
      if (updates.maxMarks < maxAwarded) throw badRequest(`Maximum marks cannot be lower than marks already awarded (${maxAwarded}).`);
    }
  }

  const before = { scheduledDate: task.scheduledDate, availableAt: task.availableAt, dueAt: task.dueAt, maxMarks: task.maxMarks, isRequired: task.isRequired };
  await task.update(updates);
  await audit({
    actorId: admin.id,
    action: 'task.updated',
    entityType: 'InternshipTask',
    entityId: id,
    metadata: { fields: Object.keys(updates), before, reason: data.changeReason || null },
    ip,
  });

  if (released && deadlineChanged) {
    const enrollments = await InternshipEnrollment.findAll({ where: { programId: task.programId, status: ['approved', 'in_progress'] }, attributes: ['id', 'userId'] });
    for (const e of enrollments) {
      await notify({
        userId: e.userId,
        type: 'task_deadline_changed',
        title: 'Task deadline changed',
        message: `The deadline for "${task.title}" has changed. Reason: ${data.changeReason}`,
        resourceType: 'InternshipTask',
        resourceId: task.id,
        link: `/student/internship/tasks/${task.id}`,
      });
    }
  }
  return serializeTask(task);
}

export async function setTaskStatus(admin, id, status, { ip } = {}) {
  const task = await InternshipTask.findByPk(id);
  if (!task) throw notFound('Task not found.');
  if (task.status === status) return serializeTask(task);
  const submissions = await TaskSubmission.count({ where: { taskId: id } });
  if (status === 'draft' && submissions > 0) throw conflict('This task already has submissions and cannot return to draft. Archive it instead.');
  await task.update({ status });
  await audit({ actorId: admin.id, action: `task.${status}`, entityType: 'InternshipTask', entityId: id, metadata: { submissions }, ip });
  return serializeTask(task);
}

export async function deleteTask(admin, id, { ip } = {}) {
  const task = await InternshipTask.findByPk(id);
  if (!task) throw notFound('Task not found.');
  const submissions = await TaskSubmission.count({ where: { taskId: id } });
  if (submissions > 0) throw conflict('This task has submissions and cannot be deleted. Archive it instead.');
  await task.destroy();
  await audit({ actorId: admin.id, action: 'task.deleted', entityType: 'InternshipTask', entityId: id, metadata: { title: task.title }, ip });
}

/**
 * Bulk-creates tasks from a plan of { weekNumber, scheduledDay, ...fields }.
 * Entries that land on non-working days or holidays are skipped and reported — never silently moved.
 */
export async function generateTasksFromPlan(admin, programId, plan, { publish = false, ip } = {}) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  const holidays = await loadHolidays(programId);
  const created = [];
  const skipped = [];
  await sequelize.transaction(async (transaction) => {
    for (const item of plan) {
      const day = item.scheduledDate
        ? programDays(program, holidays).find((d) => d.date === item.scheduledDate)
        : dateForWeekDay(program, item.weekNumber, item.scheduledDay, holidays);
      if (!day || !day.isWorkingDay) {
        skipped.push({ title: item.title, weekNumber: item.weekNumber, scheduledDay: item.scheduledDay, reason: !day ? 'outside_program' : day.dayType });
        continue;
      }
      const times = computeTaskTimes(program, day.date);
      const task = await InternshipTask.create(
        {
          ...Object.fromEntries(TASK_FIELDS.filter((f) => item[f] !== undefined).map((f) => [f, item[f]])),
          programId,
          weekNumber: day.weekNumber,
          scheduledDay: day.weekday,
          scheduledDate: day.date,
          availableAt: times.availableAt,
          dueAt: times.dueAt,
          status: publish ? 'published' : 'draft',
          createdBy: admin?.id || null,
        },
        { transaction }
      );
      created.push(task);
    }
    if (admin) {
      await audit({ actorId: admin.id, action: 'task.bulk_created', entityType: 'InternshipProgram', entityId: programId, metadata: { created: created.length, skipped: skipped.length }, ip, transaction });
    }
  });
  return { created: created.map(serializeTask), skipped };
}

// ---------------- Participant ----------------

/** The participant's current enrollment (most recent), lazily moving approved → in_progress at the start date. */
export async function getParticipantEnrollment(user, { required = true } = {}) {
  const enrollment = await InternshipEnrollment.findOne({
    where: { userId: user.id },
    include: [{ model: InternshipProgram, as: 'program' }],
    order: [['enrolledAt', 'DESC']],
  });
  if (!enrollment) {
    if (required) throw notFound('You are not enrolled in an internship yet.');
    return null;
  }
  if (enrollment.status === 'approved' && hasProgramStarted(enrollment.program)) {
    await enrollment.update({ status: 'in_progress' });
  }
  return enrollment;
}

async function submissionsByTask(enrollmentId, taskIds) {
  if (!taskIds.length) return new Map();
  const rows = await TaskSubmission.findAll({
    where: { enrollmentId, taskId: taskIds, status: { [Op.ne]: 'superseded' } },
    order: [['version', 'DESC']],
  });
  const map = new Map();
  for (const s of rows) if (!map.has(s.taskId)) map.set(s.taskId, s);
  return map;
}

function participantView(task, latest, now) {
  const state = participantTaskState(task, latest, latest && ['approved', 'rejected'].includes(latest.status) ? { submissionId: latest.id, decision: latest.status === 'approved' ? 'approve' : 'reject' } : null, now);
  const released = new Date(task.availableAt) <= now;
  return {
    id: task.id,
    title: task.title,
    description: released ? task.description : null,
    weekNumber: task.weekNumber,
    scheduledDay: task.scheduledDay,
    scheduledDate: task.scheduledDate,
    availableAt: task.availableAt,
    dueAt: task.dueAt,
    maxMarks: task.maxMarks,
    isRequired: task.isRequired,
    skills: task.skills,
    status: state,
    isReleased: released,
    latestSubmission: latest ? { id: latest.id, version: latest.version, status: latest.status, submittedAt: latest.submittedAt, isLate: latest.isLate } : null,
  };
}

export async function participantWeek(user, weekParam) {
  const enrollment = await getParticipantEnrollment(user);
  const program = enrollment.program;
  const policy = programPolicy(program);
  const holidays = await loadHolidays(program.id);
  const weeks = totalWeeks(program);
  const now = new Date();
  const week = Math.min(Math.max(Number(weekParam) || currentWeekNumber(program, now), 1), weeks);
  const tasks = await InternshipTask.findAll({ where: { programId: program.id, status: 'published', weekNumber: week }, order: [['scheduledDate', 'ASC'], ['availableAt', 'ASC']] });
  const latest = await submissionsByTask(enrollment.id, tasks.map((t) => t.id));
  const days = weekCalendar(program, week, holidays).map((d) => ({
    ...d,
    tasks: tasks.filter((t) => t.scheduledDate === d.date).map((t) => participantView(t, latest.get(t.id), now)),
  }));
  // Exceptions: tasks scheduled on non-working dates are still listed on their date.
  return {
    week,
    totalWeeks: weeks,
    currentWeek: currentWeekNumber(program, now),
    timezone: policy.timezone,
    workingDays: policy.workingDays,
    today: new Date().toISOString(),
    days,
    enrollment: { id: enrollment.id, status: enrollment.status },
    program: { id: program.id, title: program.title, track: program.track, startDate: program.startDate, endDate: program.endDate },
  };
}

export async function participantTaskDetail(user, taskId) {
  const enrollment = await getParticipantEnrollment(user);
  const task = await InternshipTask.findOne({ where: { id: taskId, programId: enrollment.programId, status: 'published' } });
  if (!task) throw notFound('Task not found.');
  const program = enrollment.program;
  const policy = programPolicy(program);
  const now = new Date();
  if (new Date(task.availableAt) > now && !policy.schedule.allowEarlyAccess) {
    throw forbidden(`This task will be available on ${task.scheduledDate}.`);
  }
  const latest = (await submissionsByTask(enrollment.id, [task.id])).get(task.id);
  const { canSubmit, reason } = await submissionEligibility({ enrollment, program, task, latest, now });
  return {
    task: { ...serializeTask(task), status: participantView(task, latest, now).status },
    program: { id: program.id, title: program.title, timezone: policy.timezone },
    submissionPolicy: {
      allowedFileTypes: policy.submission.allowedFileTypes,
      maxFileSizeMB: policy.submission.maxFileSizeMB,
      maxFiles: policy.submission.maxFiles,
      maxVersions: policy.submission.maxVersions,
      lateSubmissionPolicy: policy.schedule.lateSubmissionPolicy,
      allowResubmitBeforeReview: policy.submission.allowResubmitBeforeReview,
    },
    canSubmit,
    cannotSubmitReason: reason,
  };
}

/**
 * Submission policy (single source of truth for UI hints and server enforcement):
 *  - enrollment must be in progress (approved & program started) — not withdrawn/suspended/completed;
 *  - task must be published and released;
 *  - first submissions after the due time follow lateSubmissionPolicy;
 *  - after the program ends, only revisions are accepted within revisionGraceDays;
 *  - a new version is allowed when revision is requested, or before review starts if enabled;
 *  - no resubmission once a submission is under review, approved or rejected;
 *  - version count is capped by maxVersions.
 */
export async function submissionEligibility({ enrollment, program, task, latest, now = new Date() }) {
  const policy = programPolicy(program);
  if (!['in_progress', 'approved'].includes(enrollment.status)) return { canSubmit: false, reason: `Your enrollment is ${enrollment.status.replace(/_/g, ' ')}.` };
  if (enrollment.status === 'approved') return { canSubmit: false, reason: 'The internship has not started yet.' };
  if (task.status !== 'published') return { canSubmit: false, reason: 'This task is not open for submissions.' };
  if (new Date(task.availableAt) > now && !policy.schedule.allowEarlyAccess) return { canSubmit: false, reason: 'This task has not been released yet.' };

  const ended = hasProgramEnded(program, now);
  if (latest) {
    if (['under_review'].includes(latest.status)) return { canSubmit: false, reason: 'Your submission is being reviewed.' };
    if (['approved', 'rejected'].includes(latest.status)) return { canSubmit: false, reason: 'This task has a finalized assessment.' };
    if (latest.version >= policy.submission.maxVersions) return { canSubmit: false, reason: 'You have reached the maximum number of submission versions for this task.' };
    if (latest.status === 'submitted' && !policy.submission.allowResubmitBeforeReview) return { canSubmit: false, reason: 'Your submission is awaiting review.' };
    if (latest.status === 'revision_required') {
      const graceEnd = programBounds(program).end.plus({ days: policy.schedule.revisionGraceDays });
      if (now > graceEnd.toJSDate()) return { canSubmit: false, reason: 'The revision window for this program has closed.' };
      return { canSubmit: true, reason: null };
    }
    if (ended) return { canSubmit: false, reason: 'The internship has ended.' };
    return { canSubmit: true, reason: null };
  }
  if (ended) return { canSubmit: false, reason: 'The internship has ended.' };
  if (new Date(task.dueAt) < now && policy.schedule.lateSubmissionPolicy === 'reject') return { canSubmit: false, reason: 'The deadline for this task has passed.' };
  return { canSubmit: true, reason: null };
}

export async function upcomingDeadlines(enrollment, limit = 5) {
  const now = new Date();
  const tasks = await InternshipTask.findAll({
    where: { programId: enrollment.programId, status: 'published', availableAt: { [Op.lte]: now }, dueAt: { [Op.gte]: now } },
    order: [['dueAt', 'ASC']],
    limit: 20,
  });
  const latest = await submissionsByTask(enrollment.id, tasks.map((t) => t.id));
  return tasks
    .map((t) => participantView(t, latest.get(t.id), now))
    .filter((t) => ['available', 'revision_required'].includes(t.status))
    .slice(0, limit);
}

export async function todaysTasks(enrollment) {
  const today = todayInProgram(enrollment.program);
  const tasks = await InternshipTask.findAll({ where: { programId: enrollment.programId, status: 'published', scheduledDate: today }, order: [['availableAt', 'ASC']] });
  const latest = await submissionsByTask(enrollment.id, tasks.map((t) => t.id));
  const now = new Date();
  return tasks.map((t) => participantView(t, latest.get(t.id), now));
}
