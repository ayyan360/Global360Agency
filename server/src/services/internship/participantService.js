import { Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  InternshipEnrollment,
  InternshipProgram,
  InternshipApplication,
  InternshipCertificate,
  InternshipTask,
  User,
} from '../../models/index.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../../utils/pagination.js';
import { notify } from '../notificationService.js';
import { audit } from '../auditService.js';
import { programPolicy } from './policy.js';
import { currentWeekNumber, totalWeeks } from './scheduleService.js';
import { loadEnrollmentResults } from './scoringService.js';
import { getParticipantEnrollment, upcomingDeadlines, todaysTasks } from './taskService.js';
import { recentFeedback } from './reviewService.js';
import { listMyApplications } from './applicationService.js';
import { evaluateEnrollment } from './certificateService.js';
import { certificatePaymentSummary } from '../certificatePaymentService.js';

function enrollmentSummary(enrollment) {
  const p = enrollment.program;
  const policy = programPolicy(p);
  return {
    id: enrollment.id,
    status: enrollment.status,
    statusReason: enrollment.statusReason,
    enrolledAt: enrollment.enrolledAt,
    completedAt: enrollment.completedAt,
    startDate: enrollment.startDate,
    endDate: enrollment.endDate,
    program: {
      id: p.id,
      title: p.title,
      slug: p.slug,
      track: p.track,
      startDate: p.startDate,
      endDate: p.endDate,
      timezone: policy.timezone,
      workingDays: policy.workingDays,
      certificateThreshold: policy.certificateThreshold,
      certificateFee: p.certificateFee,
      totalWeeks: totalWeeks(p),
    },
  };
}

export async function participantDashboard(user) {
  const enrollment = await getParticipantEnrollment(user, { required: false });
  const applications = await listMyApplications(user);
  if (!enrollment) return { enrollment: null, applications };
  const { results } = await loadEnrollmentResults(enrollment, { program: enrollment.program });
  const certificate = await InternshipCertificate.findOne({ where: { enrollmentId: enrollment.id } });
  return {
    enrollment: enrollmentSummary(enrollment),
    applications,
    currentWeek: currentWeekNumber(enrollment.program),
    results: stripTasks(results),
    upcomingDeadlines: await upcomingDeadlines(enrollment, 5),
    todaysTasks: await todaysTasks(enrollment),
    recentFeedback: await recentFeedback(enrollment.id, 4),
    certificate: certificate ? { certificateNumber: certificate.certificateNumber, status: certificate.status, issuedAt: certificate.issuedAt } : null,
  };
}

function stripTasks(results) {
  const { tasks: _tasks, ...rest } = results;
  return rest;
}

export async function participantProgress(user) {
  const enrollment = await getParticipantEnrollment(user);
  const { results, tasks } = await loadEnrollmentResults(enrollment, { program: enrollment.program });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const weeks = totalWeeks(enrollment.program);
  const weekly = [];
  for (let w = 1; w <= weeks; w += 1) {
    const rows = results.tasks.filter((r) => byId.get(r.taskId).weekNumber === w && r.isRequired);
    const marks = rows.filter((r) => r.marks !== null);
    weekly.push({
      week: w,
      total: rows.length,
      approved: rows.filter((r) => r.state === 'approved').length,
      submitted: rows.filter((r) => !['scheduled', 'available', 'overdue'].includes(r.state)).length,
      scorePercent: marks.length ? Math.round((marks.reduce((s, r) => s + r.marks, 0) / marks.reduce((s, r) => s + r.maxMarks, 0)) * 100) : null,
    });
  }
  const skills = {};
  for (const r of results.tasks) {
    const t = byId.get(r.taskId);
    for (const s of t.skills || []) {
      skills[s] = skills[s] || { skill: s, tasks: 0, approved: 0 };
      skills[s].tasks += 1;
      if (r.state === 'approved') skills[s].approved += 1;
    }
  }
  return {
    enrollment: enrollmentSummary(enrollment),
    results: stripTasks(results),
    weekly,
    skills: Object.values(skills).sort((a, b) => b.tasks - a.tasks),
    tasks: results.tasks.map((r) => {
      const t = byId.get(r.taskId);
      return { id: t.id, title: t.title, weekNumber: t.weekNumber, scheduledDate: t.scheduledDate, dueAt: t.dueAt, isRequired: t.isRequired, maxMarks: t.maxMarks, state: r.state, marks: r.marks };
    }),
    recentFeedback: await recentFeedback(enrollment.id, 10),
  };
}

export async function participantCertificate(user) {
  const enrollment = await getParticipantEnrollment(user);
  const { results } = await loadEnrollmentResults(enrollment, { program: enrollment.program });
  const certificate = await InternshipCertificate.findOne({ where: { enrollmentId: enrollment.id } });
  const certificatePayment = certificate
    ? await certificatePaymentSummary({
        certificateType: 'internship',
        certificate,
        userId: user.id,
        fee: enrollment.program.certificateFee,
      })
    : null;
  return {
    enrollment: enrollmentSummary(enrollment),
    results: stripTasks(results),
    certificate: certificate
      ? {
          id: certificate.id,
          certificateNumber: certificate.certificateNumber,
          recipientName: certificate.recipientName,
          programTitle: certificate.programTitle,
          track: certificate.track,
          startDate: certificate.startDate,
          endDate: certificate.endDate,
          completionDate: certificate.completionDate,
          finalScore: certificate.finalScore,
          issuedAt: certificate.issuedAt,
          status: certificate.status,
          revokedAt: certificate.revokedAt,
          verificationPath: `/verify-certificate/${certificate.certificateNumber}`,
        }
      : null,
    certificatePayment,
  };
}

// ---------------- Admin ----------------

export const ENROLLMENT_TRANSITIONS = {
  approved: ['in_progress', 'withdrawn', 'suspended'],
  in_progress: ['withdrawn', 'suspended'],
  suspended: ['in_progress', 'withdrawn'],
  completed_qualified: [],
  completed_not_qualified: [],
  withdrawn: [],
};

export async function adminListEnrollments({ programId, status, search, page = 1, pageSize = 20 }) {
  const where = {};
  if (programId) where.programId = programId;
  if (status) where.status = status;
  const userWhere = search ? { [Op.or]: [{ name: { [Op.iLike]: likeTerm(search) } }, { email: { [Op.iLike]: likeTerm(search) } }] } : undefined;
  const { rows, count } = await InternshipEnrollment.findAndCountAll({
    where,
    include: [
      { model: User, as: 'participant', attributes: ['id', 'name', 'email'], where: userWhere },
      { model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track', 'startDate', 'endDate', 'timezone', 'certificateThreshold', 'workingDays', 'scheduleConfig', 'scoringPolicy', 'completionRules', 'submissionConfig', 'status'] },
      { model: InternshipCertificate, as: 'certificate', attributes: ['id', 'certificateNumber', 'status'] },
    ],
    order: [['enrolledAt', 'DESC']],
    distinct: true,
    ...toLimitOffset({ page, pageSize }),
  });
  const items = [];
  for (const e of rows) {
    const { results } = await loadEnrollmentResults(e, { program: e.program });
    items.push({
      id: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      participant: e.participant,
      program: { id: e.program.id, title: e.program.title, track: e.program.track, startDate: e.program.startDate, endDate: e.program.endDate },
      certificate: e.certificate,
      completionProgress: results.completionProgress,
      finalScore: results.finalScore,
      provisionalScore: results.provisionalScore,
      outcome: results.outcome,
      counts: results.counts,
    });
  }
  return { items, meta: pageMeta({ page, pageSize }, count) };
}

export async function adminGetEnrollment(id) {
  const enrollment = await InternshipEnrollment.findByPk(id, {
    include: [
      { model: User, as: 'participant', attributes: ['id', 'name', 'email', 'phone', 'createdAt'] },
      { model: InternshipProgram, as: 'program' },
      { model: InternshipApplication, as: 'application' },
      { model: InternshipCertificate, as: 'certificate' },
    ],
  });
  if (!enrollment) throw notFound('Enrollment not found.');
  const { results, tasks } = await loadEnrollmentResults(enrollment, { program: enrollment.program });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    ...enrollmentSummary(enrollment),
    participant: enrollment.participant,
    application: enrollment.application ? { id: enrollment.application.id, status: enrollment.application.status, createdAt: enrollment.application.createdAt } : null,
    certificate: enrollment.certificate,
    results: { ...results, tasks: results.tasks.map((r) => ({ ...r, title: byId.get(r.taskId).title, weekNumber: byId.get(r.taskId).weekNumber, scheduledDate: byId.get(r.taskId).scheduledDate })) },
  };
}

export async function adminSetEnrollmentStatus(admin, id, { status, reason }, { ip } = {}) {
  return sequelize.transaction(async (transaction) => {
    const enrollment = await InternshipEnrollment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!enrollment) throw notFound('Enrollment not found.');
    const allowed = ENROLLMENT_TRANSITIONS[enrollment.status] || [];
    if (!allowed.includes(status)) throw badRequest(`Enrollment cannot move from "${enrollment.status.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}".`, { code: 'INVALID_TRANSITION' });
    if (['withdrawn', 'suspended'].includes(status) && (!reason || reason.trim().length < 3)) throw badRequest('A reason is required.');
    const previous = enrollment.status;
    await enrollment.update({ status, statusReason: reason?.trim() || null }, { transaction });
    await audit({ actorId: admin.id, action: `enrollment.${status}`, entityType: 'InternshipEnrollment', entityId: id, metadata: { from: previous, to: status, reason }, ip, transaction });
    await notify(
      {
        userId: enrollment.userId,
        type: 'enrollment_status_changed',
        title: 'Internship status updated',
        message: `Your internship status is now "${status.replace(/_/g, ' ')}".${reason ? ` Reason: ${reason}` : ''}`,
        resourceType: 'InternshipEnrollment',
        resourceId: id,
        link: '/student/internship',
      },
      { transaction }
    );
    return enrollment;
  });
}

export async function participantWithdraw(user, reason) {
  const enrollment = await getParticipantEnrollment(user);
  if (!['approved', 'in_progress'].includes(enrollment.status)) throw badRequest('This internship can no longer be withdrawn from.');
  await enrollment.update({ status: 'withdrawn', statusReason: reason?.slice(0, 500) || 'Withdrawn by participant' });
  await audit({ actorId: user.id, action: 'enrollment.withdrawn_by_participant', entityType: 'InternshipEnrollment', entityId: enrollment.id, metadata: {} });
  return enrollment;
}

export async function adminEvaluateEnrollment(admin, id, { ip } = {}) {
  return evaluateEnrollment(id, { actorId: admin.id, ip });
}

export async function programReport(programId) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  const q = (sql) => sequelize.query(sql, { replacements: { programId }, type: QueryTypes.SELECT });
  const applications = await q(`SELECT status, COUNT(*)::int AS count FROM internship_applications WHERE "programId" = :programId GROUP BY status`);
  const enrollments = await q(`SELECT status, COUNT(*)::int AS count FROM internship_enrollments WHERE "programId" = :programId GROUP BY status`);
  const tasks = await q(`
    SELECT t.id, t.title, t."weekNumber", t."scheduledDate", t."maxMarks", t."isRequired",
      COUNT(DISTINCT s."enrollmentId") FILTER (WHERE s.status <> 'superseded')::int AS "submittedBy",
      COUNT(*) FILTER (WHERE s.status IN ('submitted','under_review'))::int AS "pendingReview",
      COUNT(*) FILTER (WHERE s.status = 'approved')::int AS "approved",
      ROUND(AVG(a."marksAwarded") FILTER (WHERE a."isFinal" AND a."supersededAt" IS NULL), 2)::float AS "avgMarks"
    FROM internship_tasks t
    LEFT JOIN task_submissions s ON s."taskId" = t.id
    LEFT JOIN task_assessments a ON a."submissionId" = s.id
    WHERE t."programId" = :programId AND t.status = 'published'
    GROUP BY t.id ORDER BY t."scheduledDate"`);
  const [certs] = await q(`SELECT COUNT(*) FILTER (WHERE c.status = 'valid')::int AS valid, COUNT(*) FILTER (WHERE c.status = 'revoked')::int AS revoked
    FROM internship_certificates c JOIN internship_enrollments e ON e.id = c."enrollmentId" WHERE e."programId" = :programId`);
  const [scores] = await q(`SELECT ROUND(AVG("finalScore"),2)::float AS "averageFinalScore", COUNT("finalScore")::int AS "scored" FROM internship_enrollments WHERE "programId" = :programId AND "finalScore" IS NOT NULL`);
  return {
    program: { id: program.id, title: program.title, track: program.track, startDate: program.startDate, endDate: program.endDate, certificateThreshold: Number(program.certificateThreshold) },
    applications,
    enrollments,
    tasks,
    certificates: certs,
    scores,
  };
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // prevent spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function participantsCsv(programId) {
  const program = await InternshipProgram.findByPk(programId);
  if (!program) throw notFound('Internship program not found.');
  const enrollments = await InternshipEnrollment.findAll({
    where: { programId },
    include: [{ model: User, as: 'participant', attributes: ['name', 'email'] }, { model: InternshipCertificate, as: 'certificate', attributes: ['certificateNumber', 'status'] }],
    order: [['enrolledAt', 'ASC']],
  });
  const header = ['Name', 'Email', 'Status', 'Enrolled at', 'Required tasks', 'Approved', 'Pending review', 'Overdue', 'Completion %', 'Final score %', 'Provisional score %', 'Outcome', 'Certificate', 'Certificate status'];
  const lines = [header.map(csvCell).join(',')];
  for (const e of enrollments) {
    const { results } = await loadEnrollmentResults(e, { program });
    lines.push(
      [e.participant.name, e.participant.email, e.status, e.enrolledAt.toISOString(), results.counts.totalRequired, results.counts.approved, results.counts.pendingReview, results.counts.overdue, results.completionProgress, results.finalScore, results.provisionalScore, results.outcome, e.certificate?.certificateNumber, e.certificate?.status]
        .map(csvCell)
        .join(',')
    );
  }
  return { filename: `${program.slug}-participants.csv`, csv: lines.join('\n') };
}

export async function taskCountForProgram(programId) {
  return InternshipTask.count({ where: { programId, status: 'published' } });
}
