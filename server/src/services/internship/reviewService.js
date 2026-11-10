import { Op } from 'sequelize';
import {
  sequelize,
  InternshipTask,
  InternshipEnrollment,
  InternshipProgram,
  InternshipReviewerAssignment,
  TaskSubmission,
  SubmissionAttachment,
  TaskAssessment,
  TaskReviewHistory,
  User,
} from '../../models/index.js';
import { notFound, badRequest, forbidden, conflict, unprocessable } from '../../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../../utils/pagination.js';
import { notify } from '../notificationService.js';
import { audit } from '../auditService.js';
import { programPolicy } from './policy.js';
import { isAssignedReviewer } from './submissionService.js';

/** Program/enrollment scope a reviewer is allowed to see. Admins see everything. */
async function reviewerScope(user) {
  if (user.role === 'admin') return null;
  const rows = await InternshipReviewerAssignment.findAll({ where: { reviewerId: user.id } });
  return {
    programIds: rows.filter((r) => !r.enrollmentId).map((r) => r.programId),
    enrollmentIds: rows.filter((r) => r.enrollmentId).map((r) => r.enrollmentId),
  };
}

export async function reviewerPrograms(user) {
  const scope = await reviewerScope(user);
  const where = scope ? { id: [...new Set([...scope.programIds, ...(await InternshipEnrollment.findAll({ where: { id: scope.enrollmentIds }, attributes: ['programId'] })).map((e) => e.programId)])] } : {};
  const programs = await InternshipProgram.findAll({ where, attributes: ['id', 'title', 'track', 'status', 'startDate', 'endDate'], order: [['startDate', 'DESC']] });
  return programs;
}

export async function reviewQueue(user, { programId, taskId, participant, status, assignedToMe, submittedFrom, submittedTo, dueBefore, page = 1, pageSize = 20, sort = 'oldest' }) {
  const scope = await reviewerScope(user);
  const where = { status: status ? status : { [Op.in]: ['submitted', 'under_review'] } };
  if (submittedFrom || submittedTo) {
    where.submittedAt = {};
    if (submittedFrom) where.submittedAt[Op.gte] = new Date(submittedFrom);
    if (submittedTo) where.submittedAt[Op.lte] = new Date(`${submittedTo}T23:59:59.999Z`);
  }
  if (taskId) where.taskId = taskId;

  const enrollmentWhere = {};
  if (programId) enrollmentWhere.programId = programId;
  if (scope) {
    enrollmentWhere[Op.and] = [{ [Op.or]: [{ programId: scope.programIds }, { id: scope.enrollmentIds }] }];
  }
  if (assignedToMe && user.role === 'admin') {
    const mine = await reviewerScope({ ...user.get({ plain: true }), role: 'reviewer', id: user.id });
    enrollmentWhere[Op.and] = [...(enrollmentWhere[Op.and] || []), { [Op.or]: [{ programId: mine.programIds }, { id: mine.enrollmentIds }] }];
  }
  const participantWhere = participant ? { [Op.or]: [{ name: { [Op.iLike]: likeTerm(participant) } }, { email: { [Op.iLike]: likeTerm(participant) } }] } : undefined;
  const taskWhere = dueBefore ? { dueAt: { [Op.lte]: new Date(`${dueBefore}T23:59:59.999Z`) } } : undefined;

  const { rows, count } = await TaskSubmission.findAndCountAll({
    where,
    include: [
      { model: InternshipTask, as: 'task', attributes: ['id', 'title', 'maxMarks', 'dueAt', 'weekNumber', 'scheduledDate', 'isRequired'], where: taskWhere },
      {
        model: InternshipEnrollment,
        as: 'enrollment',
        attributes: ['id', 'programId', 'userId', 'status'],
        where: enrollmentWhere,
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name', 'email'], where: participantWhere },
          { model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track'] },
        ],
      },
    ],
    order: [['submittedAt', sort === 'newest' ? 'DESC' : 'ASC']],
    distinct: true,
    ...toLimitOffset({ page, pageSize }),
  });

  return {
    items: rows.map((s) => ({
      id: s.id,
      version: s.version,
      status: s.status,
      isLate: s.isLate,
      submittedAt: s.submittedAt,
      task: s.task,
      participant: s.enrollment.participant,
      program: s.enrollment.program,
      enrollmentId: s.enrollment.id,
    })),
    meta: pageMeta({ page, pageSize }, count),
  };
}

async function loadSubmission(id, transaction, lock = false) {
  const submission = await TaskSubmission.findByPk(id, { transaction, lock: lock ? transaction.LOCK.UPDATE : undefined });
  if (!submission) throw notFound('Submission not found.');
  submission.task = await InternshipTask.findByPk(submission.taskId, { transaction });
  submission.enrollment = await InternshipEnrollment.findByPk(submission.enrollmentId, { transaction });
  return submission;
}

async function assertCanReview(user, enrollment) {
  if (user.role === 'admin') return;
  if (user.role !== 'reviewer' || !(await isAssignedReviewer(user.id, enrollment))) {
    throw forbidden('You are not assigned to review this participant.');
  }
}

export async function getSubmissionForReview(user, id) {
  const submission = await loadSubmission(id);
  await assertCanReview(user, submission.enrollment);
  const participant = await User.findByPk(submission.enrollment.userId, { attributes: ['id', 'name', 'email'] });
  const program = await InternshipProgram.findByPk(submission.enrollment.programId, { attributes: ['id', 'title', 'track', 'timezone'] });
  const versions = await TaskSubmission.findAll({
    where: { taskId: submission.taskId, enrollmentId: submission.enrollmentId },
    include: [
      { model: SubmissionAttachment, as: 'attachments' },
      { model: TaskAssessment, as: 'assessments', include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }] },
      { model: TaskReviewHistory, as: 'history', include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }] },
    ],
    order: [['version', 'DESC']],
  });
  const latestVersion = versions.find((v) => v.status !== 'superseded')?.version;
  return {
    submission: { id: submission.id, version: submission.version, status: submission.status, isLatest: submission.version === latestVersion },
    task: submission.task,
    participant,
    program,
    enrollment: { id: submission.enrollment.id, status: submission.enrollment.status },
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      submissionText: v.submissionText,
      repositoryUrl: v.repositoryUrl,
      liveUrl: v.liveUrl,
      isLate: v.isLate,
      submittedAt: v.submittedAt,
      attachments: v.attachments.map((a) => ({ id: a.id, originalFileName: a.originalFileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
      assessments: v.assessments
        .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))
        .map((a) => ({ id: a.id, decision: a.decision, marksAwarded: a.marksAwarded, feedback: a.feedback, isFinal: a.isFinal, assessedAt: a.assessedAt, supersededAt: a.supersededAt, amendmentReason: a.amendmentReason, reviewer: a.reviewer })),
      history: v.history
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((h) => ({ id: h.id, action: h.action, previousStatus: h.previousStatus, newStatus: h.newStatus, feedback: h.feedback, createdAt: h.createdAt, actor: h.actor })),
    })),
  };
}

export async function startReview(user, id) {
  return sequelize.transaction(async (transaction) => {
    const submission = await loadSubmission(id, transaction, true);
    await assertCanReview(user, submission.enrollment);
    if (submission.status !== 'submitted') throw conflict(`This submission is ${submission.status.replace(/_/g, ' ')}.`);
    await submission.update({ status: 'under_review' }, { transaction });
    await TaskReviewHistory.create({ submissionId: id, reviewerId: user.id, previousStatus: 'submitted', newStatus: 'under_review', action: 'review_started' }, { transaction });
    return { id, status: 'under_review' };
  });
}

const DECISION_TO_STATUS = { approve: 'approved', request_revision: 'revision_required', reject: 'rejected' };

/**
 * Records an assessment on the latest submission version.
 *  - approve/reject are final and require marks in [0, maxMarks];
 *  - request_revision is not final (marks optional, provisional) and allows a new version;
 *  - finalized assessments can only be changed through amendAssessment (admin, audited).
 */
export async function assessSubmission(user, id, { decision, marksAwarded, feedback }, { ip } = {}) {
  const result = await sequelize.transaction(async (transaction) => {
    const submission = await loadSubmission(id, transaction, true);
    await assertCanReview(user, submission.enrollment);
    if (!['submitted', 'under_review'].includes(submission.status)) {
      throw conflict(
        ['approved', 'rejected'].includes(submission.status)
          ? 'This submission already has a finalized assessment.'
          : `This submission is ${submission.status.replace(/_/g, ' ')} and cannot be assessed.`,
        { code: 'NOT_ASSESSABLE' }
      );
    }
    const newer = await TaskSubmission.count({ where: { taskId: submission.taskId, enrollmentId: submission.enrollmentId, version: { [Op.gt]: submission.version } }, transaction });
    if (newer > 0) throw conflict('A newer version of this submission exists. Assess the latest version.');

    const max = submission.task.maxMarks;
    const isFinal = decision !== 'request_revision';
    if (isFinal && (marksAwarded === undefined || marksAwarded === null)) throw unprocessable('Marks are required to approve or reject a submission.', [{ field: 'marksAwarded', message: 'Required' }]);
    if (marksAwarded !== undefined && marksAwarded !== null && (marksAwarded < 0 || marksAwarded > max)) {
      throw unprocessable(`Marks must be between 0 and ${max}.`, [{ field: 'marksAwarded', message: `Between 0 and ${max}` }]);
    }
    if (decision === 'request_revision') {
      const program = await InternshipProgram.findByPk(submission.enrollment.programId, { transaction });
      const { maxVersions } = programPolicy(program).submission;
      if (submission.version >= maxVersions) throw badRequest(`The participant has used all ${maxVersions} allowed versions. Approve or reject this submission.`);
    }

    const assessment = await TaskAssessment.create(
      { submissionId: id, reviewerId: user.id, marksAwarded: marksAwarded ?? null, feedback, decision, isFinal, assessedAt: new Date() },
      { transaction }
    );
    const previousStatus = submission.status;
    const newStatus = DECISION_TO_STATUS[decision];
    await submission.update({ status: newStatus }, { transaction });
    await TaskReviewHistory.create({ submissionId: id, reviewerId: user.id, previousStatus, newStatus, action: `assessed_${decision}`, feedback }, { transaction });
    await audit({
      actorId: user.id,
      action: isFinal ? 'assessment.finalized' : 'assessment.revision_requested',
      entityType: 'TaskSubmission',
      entityId: id,
      metadata: { decision, marksAwarded: marksAwarded ?? null, maxMarks: max, assessmentId: assessment.id },
      ip,
      transaction,
    });

    const messages = {
      approve: ['assessment_finalized', 'Task approved', `"${submission.task.title}" was approved with ${marksAwarded}/${max} marks.`],
      reject: ['assessment_finalized', 'Task assessed', `"${submission.task.title}" was not approved (${marksAwarded}/${max} marks). See feedback for details.`],
      request_revision: ['revision_requested', 'Revision requested', `Your reviewer requested changes to "${submission.task.title}".`],
    };
    const [type, title, message] = messages[decision];
    await notify(
      { userId: submission.enrollment.userId, type, title, message, resourceType: 'TaskSubmission', resourceId: id, link: `/student/internship/tasks/${submission.taskId}`, dedupeKey: `assessment:${assessment.id}` },
      { transaction }
    );
    return { assessment, status: newStatus };
  });
  return result;
}

/** Admin-only, audited correction of a finalized assessment. The previous assessment is kept and marked superseded. */
export async function amendAssessment(admin, assessmentId, { decision, marksAwarded, feedback, reason }, { ip } = {}) {
  if (!reason || reason.trim().length < 5) throw badRequest('A reason is required to amend a finalized assessment.');
  if (!['approve', 'reject'].includes(decision)) throw badRequest('Amended assessments must approve or reject.');
  return sequelize.transaction(async (transaction) => {
    const previous = await TaskAssessment.findByPk(assessmentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!previous) throw notFound('Assessment not found.');
    if (!previous.isFinal || previous.supersededAt) throw conflict('Only the current finalized assessment can be amended.');
    const submission = await loadSubmission(previous.submissionId, transaction, true);
    const max = submission.task.maxMarks;
    if (marksAwarded < 0 || marksAwarded > max) throw unprocessable(`Marks must be between 0 and ${max}.`);

    await previous.update({ supersededAt: new Date() }, { transaction });
    const amended = await TaskAssessment.create(
      { submissionId: submission.id, reviewerId: admin.id, marksAwarded, feedback, decision, isFinal: true, assessedAt: new Date(), amendmentReason: reason.trim() },
      { transaction }
    );
    await previous.update({ supersededById: amended.id }, { transaction });
    const previousStatus = submission.status;
    await submission.update({ status: DECISION_TO_STATUS[decision] }, { transaction });
    await TaskReviewHistory.create(
      { submissionId: submission.id, reviewerId: admin.id, previousStatus, newStatus: DECISION_TO_STATUS[decision], action: 'assessment_amended', feedback: `${reason.trim()}\n\n${feedback}` },
      { transaction }
    );
    await audit({
      actorId: admin.id,
      action: 'assessment.amended',
      entityType: 'TaskAssessment',
      entityId: amended.id,
      metadata: { previousAssessmentId: previous.id, before: { decision: previous.decision, marksAwarded: previous.marksAwarded }, after: { decision, marksAwarded }, reason: reason.trim() },
      ip,
      transaction,
    });
    await notify(
      {
        userId: submission.enrollment.userId,
        type: 'assessment_finalized',
        title: 'Assessment updated',
        message: `The assessment for "${submission.task.title}" was updated: ${marksAwarded}/${max} marks.`,
        resourceType: 'TaskSubmission',
        resourceId: submission.id,
        link: `/student/internship/tasks/${submission.taskId}`,
        dedupeKey: `assessment:${amended.id}`,
      },
      { transaction }
    );
    return amended;
  });
}

export async function recentFeedback(enrollmentId, limit = 5) {
  const rows = await TaskAssessment.findAll({
    where: { supersededAt: null },
    include: [
      {
        model: TaskSubmission,
        as: 'submission',
        where: { enrollmentId },
        attributes: ['id', 'version', 'taskId'],
        include: [{ model: InternshipTask, as: 'task', attributes: ['id', 'title', 'maxMarks'] }],
      },
      { model: User, as: 'reviewer', attributes: ['id', 'name'] },
    ],
    order: [['assessedAt', 'DESC']],
    limit,
  });
  return rows.map((a) => ({
    id: a.id,
    decision: a.decision,
    marksAwarded: a.marksAwarded,
    maxMarks: a.submission.task.maxMarks,
    feedback: a.feedback,
    assessedAt: a.assessedAt,
    task: { id: a.submission.task.id, title: a.submission.task.title },
    reviewer: a.reviewer ? { name: a.reviewer.name } : null,
  }));
}
