import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  InternshipProgram,
  InternshipHoliday,
  InternshipEnrollment,
  InternshipApplication,
  InternshipTask,
  InternshipReviewerAssignment,
  User,
} from '../../models/index.js';
import { notFound, badRequest, conflict } from '../../utils/errors.js';
import { uniqueSlug } from '../../utils/slug.js';
import { toLimitOffset, pageMeta, likeTerm } from '../../utils/pagination.js';
import { audit } from '../auditService.js';
import { programPolicy } from './policy.js';
import { programDays, isValidTimezone, totalWeeks, computeTaskTimes } from './scheduleService.js';

const ACTIVE_ENROLLMENT = ['approved', 'in_progress', 'completed_qualified', 'completed_not_qualified'];

export function applicationWindow(program, now = new Date()) {
  const opensAt = program.applicationOpenAt ? new Date(program.applicationOpenAt) : null;
  const closesAt = program.applicationCloseAt ? new Date(program.applicationCloseAt) : null;
  if (program.status !== 'published') return { isOpen: false, state: 'unavailable', opensAt, closesAt };
  if (opensAt && now < opensAt) return { isOpen: false, state: 'not_yet_open', opensAt, closesAt };
  if (closesAt && now > closesAt) return { isOpen: false, state: 'closed', opensAt, closesAt };
  return { isOpen: true, state: 'open', opensAt, closesAt };
}

async function enrolledCount(programId, transaction) {
  return InternshipEnrollment.count({ where: { programId, status: ACTIVE_ENROLLMENT }, transaction });
}

export function serializeProgram(program, extra = {}) {
  const p = program.get({ plain: true });
  const policy = programPolicy(program);
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    track: p.track,
    durationMonths: p.durationMonths,
    durationWeeks: p.durationWeeks,
    startDate: p.startDate,
    endDate: p.endDate,
    applicationOpenAt: p.applicationOpenAt,
    applicationCloseAt: p.applicationCloseAt,
    capacity: p.capacity,
    workingDays: policy.workingDays,
    timezone: policy.timezone,
    certificateThreshold: policy.certificateThreshold,
    certificateFee: p.certificateFee,
    scheduleConfig: policy.schedule,
    scoringPolicy: policy.scoring,
    completionRules: policy.completion,
    submissionConfig: policy.submission,
    objectives: p.objectives,
    skills: p.skills,
    eligibility: p.eligibility,
    weeklyCurriculum: p.weeklyCurriculum,
    status: p.status,
    isSample: p.isSample,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...extra,
  };
}

export async function listPublicPrograms() {
  const programs = await InternshipProgram.findAll({ where: { status: 'published' }, order: [['startDate', 'ASC'], ['title', 'ASC']] });
  const out = [];
  for (const p of programs) {
    const seatsTaken = p.capacity ? await enrolledCount(p.id) : null;
    out.push(
      serializeProgram(p, {
        applicationWindow: applicationWindow(p),
        seatsRemaining: p.capacity ? Math.max(0, p.capacity - seatsTaken) : null,
      })
    );
  }
  return out;
}

export async function listTracks() {
  return sequelize.query(
    `SELECT track AS name, COUNT(*)::int AS programs FROM internship_programs WHERE status = 'published' GROUP BY track ORDER BY track`,
    { type: QueryTypes.SELECT }
  );
}

export async function getPublicProgram(slug, user) {
  const program = await InternshipProgram.findOne({ where: { slug } });
  if (!program || (program.status !== 'published' && user?.role !== 'admin')) throw notFound('Internship program not found.');
  const holidays = await InternshipHoliday.findAll({ where: { programId: program.id }, order: [['date', 'ASC']] });
  const days = programDays(program, holidays);
  const seatsTaken = program.capacity ? await enrolledCount(program.id) : null;
  let viewer = null;
  if (user) {
    const application = await InternshipApplication.findOne({ where: { userId: user.id, programId: program.id }, order: [['createdAt', 'DESC']] });
    const enrollment = await InternshipEnrollment.findOne({ where: { userId: user.id, programId: program.id } });
    viewer = {
      application: application ? { id: application.id, status: application.status, createdAt: application.createdAt } : null,
      enrollment: enrollment ? { id: enrollment.id, status: enrollment.status } : null,
    };
  }
  return serializeProgram(program, {
    applicationWindow: applicationWindow(program),
    seatsRemaining: program.capacity ? Math.max(0, program.capacity - seatsTaken) : null,
    schedule: {
      totalWeeks: totalWeeks(program),
      workingDayCount: days.filter((d) => d.isWorkingDay).length,
      holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
    },
    viewer,
  });
}

// ---------------- Admin ----------------

function validateProgramConfig(data) {
  if (data.timezone && !isValidTimezone(data.timezone)) throw badRequest(`Unknown timezone "${data.timezone}".`);
  if (data.startDate && data.endDate && data.endDate <= data.startDate) throw badRequest('End date must be after the start date.');
  if (data.applicationOpenAt && data.applicationCloseAt && new Date(data.applicationCloseAt) <= new Date(data.applicationOpenAt)) {
    throw badRequest('Application closing date must be after the opening date.');
  }
  if (data.workingDays && (!data.workingDays.length || data.workingDays.some((d) => d < 1 || d > 7))) {
    throw badRequest('Working days must contain ISO weekdays between 1 (Monday) and 7 (Sunday).');
  }
}

export async function adminListPrograms({ search, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (search) where[Op.or] = [{ title: { [Op.iLike]: likeTerm(search) } }, { track: { [Op.iLike]: likeTerm(search) } }];
  const { rows, count } = await InternshipProgram.findAndCountAll({
    where,
    attributes: {
      include: [
        [sequelize.literal(`(SELECT COUNT(*)::int FROM internship_applications a WHERE a."programId" = "InternshipProgram"."id" AND a.status IN ('pending','under_review'))`), 'pendingApplications'],
        [sequelize.literal(`(SELECT COUNT(*)::int FROM internship_enrollments e WHERE e."programId" = "InternshipProgram"."id" AND e.status IN ('approved','in_progress'))`), 'activeParticipants'],
        [sequelize.literal(`(SELECT COUNT(*)::int FROM internship_tasks t WHERE t."programId" = "InternshipProgram"."id" AND t.status = 'published')`), 'publishedTasks'],
      ],
    },
    order: [['startDate', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return {
    items: rows.map((p) =>
      serializeProgram(p, {
        pendingApplications: p.get('pendingApplications'),
        activeParticipants: p.get('activeParticipants'),
        publishedTasks: p.get('publishedTasks'),
      })
    ),
    meta: pageMeta({ page, pageSize }, count),
  };
}

export async function adminGetProgram(id) {
  const program = await InternshipProgram.findByPk(id);
  if (!program) throw notFound('Internship program not found.');
  const holidays = await InternshipHoliday.findAll({ where: { programId: id }, order: [['date', 'ASC']] });
  const reviewers = await InternshipReviewerAssignment.findAll({
    where: { programId: id },
    include: [{ model: User, as: 'reviewer', attributes: ['id', 'name', 'email', 'role'] }, { model: InternshipEnrollment, as: 'enrollment', include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }] }],
    order: [['createdAt', 'ASC']],
  });
  return serializeProgram(program, {
    holidays: holidays.map((h) => ({ id: h.id, date: h.date, name: h.name })),
    reviewers: reviewers.map((r) => ({
      id: r.id,
      reviewer: r.reviewer,
      scope: r.enrollmentId ? 'participant' : 'program',
      participant: r.enrollment?.participant ? { id: r.enrollment.participant.id, name: r.enrollment.participant.name, enrollmentId: r.enrollmentId } : null,
    })),
    schedule: { totalWeeks: totalWeeks(program), days: programDays(program, holidays) },
    applicationWindow: applicationWindow(program),
  });
}

export async function createProgram(admin, data, { ip } = {}) {
  validateProgramConfig(data);
  const slug = await uniqueSlug(InternshipProgram, data.slug || data.title);
  const program = await InternshipProgram.create({ ...data, slug });
  await audit({ actorId: admin.id, action: 'program.created', entityType: 'InternshipProgram', entityId: program.id, metadata: { title: program.title }, ip });
  return adminGetProgram(program.id);
}

const SCHEDULE_FIELDS = ['startDate', 'endDate', 'workingDays', 'timezone', 'scheduleConfig'];

export async function updateProgram(admin, id, data, { ip } = {}) {
  const program = await InternshipProgram.findByPk(id);
  if (!program) throw notFound('Internship program not found.');
  validateProgramConfig({ ...program.get({ plain: true }), ...data });
  if (data.slug && data.slug !== program.slug) data.slug = await uniqueSlug(InternshipProgram, data.slug, { excludeId: id });

  const changed = Object.keys(data).filter((k) => JSON.stringify(program.get(k)) !== JSON.stringify(data[k]));
  const scheduleChanged = changed.some((k) => SCHEDULE_FIELDS.includes(k));
  if (scheduleChanged) {
    const published = await InternshipTask.count({ where: { programId: id, status: 'published' } });
    if (published > 0 && !data.confirmScheduleChange) {
      throw conflict(
        'This program already has published tasks. Changing dates, working days, timezone or schedule times does not move existing task deadlines. Confirm to proceed.',
        { code: 'SCHEDULE_CHANGE_CONFIRMATION_REQUIRED' }
      );
    }
  }
  delete data.confirmScheduleChange;
  const before = Object.fromEntries(changed.map((k) => [k, program.get(k)]));
  await program.update(data);
  if (changed.length) {
    await audit({
      actorId: admin.id,
      action: 'program.configuration_changed',
      entityType: 'InternshipProgram',
      entityId: id,
      metadata: { fields: changed, before, after: Object.fromEntries(changed.map((k) => [k, program.get(k)])) },
      ip,
    });
  }
  return adminGetProgram(id);
}

export async function deleteProgram(admin, id, { ip } = {}) {
  const program = await InternshipProgram.findByPk(id);
  if (!program) throw notFound('Internship program not found.');
  const apps = await InternshipApplication.count({ where: { programId: id } });
  if (apps > 0) throw conflict('This program has applications. Archive it instead of deleting it.');
  await sequelize.transaction(async (transaction) => {
    await InternshipTask.destroy({ where: { programId: id }, transaction });
    await program.destroy({ transaction });
    await audit({ actorId: admin.id, action: 'program.deleted', entityType: 'InternshipProgram', entityId: id, metadata: { title: program.title }, ip, transaction });
  });
}

export async function addHoliday(admin, programId, { date, name }, { ip } = {}) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  if (date < program.startDate || date > program.endDate) throw badRequest('Holiday must fall within the program dates.');
  const tasksOnDate = await InternshipTask.count({ where: { programId, scheduledDate: date, status: 'published' } });
  const holiday = await InternshipHoliday.create({ programId, date, name });
  await audit({ actorId: admin.id, action: 'program.holiday_added', entityType: 'InternshipProgram', entityId: programId, metadata: { date, name }, ip });
  return { holiday, warning: tasksOnDate ? `${tasksOnDate} published task(s) are scheduled on this date. Reschedule them if needed.` : null };
}

export async function removeHoliday(admin, programId, holidayId, { ip } = {}) {
  const holiday = await InternshipHoliday.findOne({ where: { id: holidayId, programId } });
  if (!holiday) throw notFound('Holiday not found.');
  await holiday.destroy();
  await audit({ actorId: admin.id, action: 'program.holiday_removed', entityType: 'InternshipProgram', entityId: programId, metadata: { date: holiday.date }, ip });
}

export async function assignReviewer(admin, programId, { reviewerId, enrollmentId }, { ip } = {}) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  const reviewer = await User.findByPk(reviewerId);
  if (!reviewer || !['reviewer', 'admin'].includes(reviewer.role) || reviewer.accountStatus !== 'active') {
    throw badRequest('Only active reviewer or admin accounts can be assigned.');
  }
  if (enrollmentId) {
    const enrollment = await InternshipEnrollment.findOne({ where: { id: enrollmentId, programId } });
    if (!enrollment) throw badRequest('That participant is not enrolled in this program.');
  }
  const [row, created] = await InternshipReviewerAssignment.findOrCreate({
    where: { programId, reviewerId, enrollmentId: enrollmentId || null },
    defaults: { programId, reviewerId, enrollmentId: enrollmentId || null, assignedBy: admin.id },
  });
  if (!created) throw conflict('This reviewer is already assigned.');
  await audit({ actorId: admin.id, action: 'reviewer.assigned', entityType: 'InternshipProgram', entityId: programId, metadata: { reviewerId, enrollmentId: enrollmentId || null }, ip });
  return row;
}

export async function removeReviewer(admin, programId, assignmentId, { ip } = {}) {
  const row = await InternshipReviewerAssignment.findOne({ where: { id: assignmentId, programId } });
  if (!row) throw notFound('Assignment not found.');
  await row.destroy();
  await audit({ actorId: admin.id, action: 'reviewer.unassigned', entityType: 'InternshipProgram', entityId: programId, metadata: { reviewerId: row.reviewerId }, ip });
}

/** Preview of release/due times for a date, used by the admin task form. */
export async function previewTaskTimes(programId, date) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  return computeTaskTimes(program, date);
}
