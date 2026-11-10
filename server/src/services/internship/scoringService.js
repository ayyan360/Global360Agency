import { Op } from 'sequelize';
import {
  InternshipTask,
  TaskSubmission,
  TaskAssessment,
  InternshipProgram,
  InternshipHoliday,
} from '../../models/index.js';
import { programPolicy } from './policy.js';
import { hasProgramEnded } from './scheduleService.js';

/** Half-up rounding to a fixed number of decimals, avoiding binary float surprises. */
export function roundHalfUp(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const PENDING_STATES = new Set(['submitted', 'under_review']);

/**
 * Determines one task's state for a participant.
 *  - latestSubmission: highest version (ignoring 'superseded')
 *  - finalAssessment: current (non-superseded) finalized assessment for any version of this task
 */
export function participantTaskState(task, latestSubmission, finalAssessment, now = new Date()) {
  if (finalAssessment && latestSubmission && finalAssessment.submissionId === latestSubmission.id) {
    return finalAssessment.decision === 'approve' ? 'approved' : 'rejected';
  }
  if (latestSubmission) {
    if (latestSubmission.status === 'revision_required') return 'revision_required';
    if (latestSubmission.status === 'under_review') return 'under_review';
    if (latestSubmission.status === 'submitted') return 'submitted';
    if (latestSubmission.status === 'approved') return 'approved';
    if (latestSubmission.status === 'rejected') return 'rejected';
  }
  if (new Date(task.availableAt) > now) return 'scheduled';
  if (new Date(task.dueAt) < now) return 'overdue';
  return 'available';
}

/**
 * Pure calculation of completion progress, score and certificate eligibility.
 *
 * completionProgress = approved required tasks / total required tasks × 100
 * finalScore         = Σ finalized marks on required tasks / Σ max marks of required tasks × 100
 *
 * Task completion and performance score are deliberately separate numbers.
 *
 * @param {object} input
 * @param {object} input.program       program row or plain object (dates, threshold, policies)
 * @param {object} input.enrollment    { status }
 * @param {Array}  input.tasks         published tasks: { id, isRequired, maxMarks, availableAt, dueAt, title }
 * @param {Map}    input.latestSubmissionByTask  taskId → latest non-superseded submission
 * @param {Map}    input.finalAssessmentByTask   taskId → current finalized assessment { submissionId, decision, marksAwarded }
 * @param {Date}   [input.now]
 */
export function calculateResults({ program, enrollment, tasks, latestSubmissionByTask, finalAssessmentByTask, now = new Date() }) {
  const policy = programPolicy(program);
  const decimals = Number.isInteger(policy.scoring.roundingDecimals) ? policy.scoring.roundingDecimals : 2;
  const threshold = policy.certificateThreshold;
  const ended = hasProgramEnded(program, now);

  const rows = tasks.map((task) => {
    const latest = latestSubmissionByTask.get(task.id) || null;
    const final = finalAssessmentByTask.get(task.id) || null;
    const state = participantTaskState(task, latest, final, now);
    const marks = final && (state === 'approved' || state === 'rejected') ? Number(final.marksAwarded) : null;
    return { task, state, marks, maxMarks: Number(task.maxMarks) };
  });

  const required = rows.filter((r) => r.task.isRequired);
  const optional = rows.filter((r) => !r.task.isRequired);

  const count = (list, ...states) => list.filter((r) => states.includes(r.state)).length;
  const counts = {
    totalRequired: required.length,
    approved: count(required, 'approved'),
    rejected: count(required, 'rejected'),
    pendingReview: count(required, 'submitted', 'under_review'),
    revisionRequired: count(required, 'revision_required'),
    overdue: count(required, 'overdue'),
    available: count(required, 'available'),
    scheduled: count(required, 'scheduled'),
    optionalTotal: optional.length,
    optionalApproved: count(optional, 'approved'),
  };

  const unresolved = required.filter((r) => PENDING_STATES.has(r.state) || r.state === 'revision_required');
  // Before the program ends, tasks not yet due are also unresolved for the purpose of a *final* score.
  const notYetDue = required.filter((r) => ['scheduled', 'available'].includes(r.state));

  const possible = required.reduce((s, r) => s + r.maxMarks, 0);
  const earned = required.reduce((s, r) => s + (r.marks ?? 0), 0);
  const assessedPossible = required.filter((r) => r.marks !== null).reduce((s, r) => s + r.maxMarks, 0);

  const completionProgress = required.length ? roundHalfUp((counts.approved / required.length) * 100, decimals) : null;
  const scoreIsFinal = ended && required.length > 0 && unresolved.length === 0 && notYetDue.length === 0;
  const finalScore = scoreIsFinal && possible > 0 ? roundHalfUp((earned / possible) * 100, decimals) : null;
  const provisionalScore = assessedPossible > 0 ? roundHalfUp((earned / assessedPossible) * 100, decimals) : null;

  const activeEnrollment = ['approved', 'in_progress', 'completed_qualified', 'completed_not_qualified'].includes(enrollment.status);
  const checks = [
    {
      key: 'enrollment',
      label: 'Approved, active internship enrollment',
      passed: activeEnrollment,
      detail: activeEnrollment ? null : `Enrollment status is ${enrollment.status.replace(/_/g, ' ')}.`,
    },
    {
      key: 'programEnded',
      label: 'Internship has reached its end date',
      passed: ended,
      detail: ended ? null : `The program ends on ${program.endDate}.`,
    },
    {
      key: 'hasRequiredTasks',
      label: 'Program has required tasks',
      passed: required.length > 0,
      detail: required.length ? null : 'No required tasks are configured, so completion cannot be assessed.',
    },
    {
      key: 'assessmentsResolved',
      label: 'All required submissions have finalized assessments',
      passed: unresolved.length === 0 && notYetDue.length === 0,
      detail:
        unresolved.length > 0
          ? `${unresolved.length} required task(s) are awaiting review or revision.`
          : notYetDue.length
            ? `${notYetDue.length} required task(s) are not yet due.`
            : null,
    },
    {
      key: 'completion',
      label: `At least ${policy.completion.minCompletionPercent}% of required tasks approved`,
      passed: completionProgress !== null && completionProgress >= policy.completion.minCompletionPercent,
      detail: completionProgress === null ? null : `${completionProgress}% of required tasks approved.`,
    },
    {
      key: 'score',
      label: `Final score of at least ${threshold}%`,
      passed: finalScore !== null && finalScore >= threshold,
      detail: finalScore === null ? 'Final score not available yet.' : `Final score is ${finalScore}%.`,
    },
  ];

  const eligible = checks.every((c) => c.passed);
  let outcome;
  if (!activeEnrollment) outcome = 'ineligible';
  else if (!ended) outcome = 'in_progress';
  else if (!required.length) outcome = 'not_qualified';
  else if (unresolved.length || notYetDue.length) outcome = 'awaiting_assessments';
  else outcome = eligible ? 'qualified' : 'not_qualified';

  return {
    threshold,
    programEnded: ended,
    completionProgress,
    finalScore,
    scoreIsFinal,
    provisionalScore,
    marks: { earned: roundHalfUp(earned, decimals), possible, assessedPossible },
    counts,
    eligible,
    outcome,
    checks,
    tasks: rows.map((r) => ({ taskId: r.task.id, state: r.state, marks: r.marks, maxMarks: r.maxMarks, isRequired: r.task.isRequired })),
    policy: {
      scoring: policy.scoring,
      completion: policy.completion,
      explanation:
        'Completion progress is the share of required tasks approved. The final score is the total marks awarded on required tasks divided by the total available marks for all required tasks. Unsubmitted required tasks count as zero. Optional tasks do not affect either figure.',
    },
  };
}

/** Loads authoritative data for an enrollment and calculates results. */
export async function loadEnrollmentResults(enrollment, { program, transaction, now = new Date() } = {}) {
  const prog = program || (await InternshipProgram.findByPk(enrollment.programId, { transaction }));
  const tasks = await InternshipTask.findAll({
    where: { programId: prog.id, status: 'published' },
    order: [['scheduledDate', 'ASC'], ['availableAt', 'ASC']],
    transaction,
  });
  const taskIds = tasks.map((t) => t.id);
  const submissions = taskIds.length
    ? await TaskSubmission.findAll({
        where: { enrollmentId: enrollment.id, taskId: taskIds, status: { [Op.ne]: 'superseded' } },
        order: [['version', 'DESC']],
        transaction,
      })
    : [];
  const latestSubmissionByTask = new Map();
  for (const s of submissions) if (!latestSubmissionByTask.has(s.taskId)) latestSubmissionByTask.set(s.taskId, s);

  const assessments = submissions.length
    ? await TaskAssessment.findAll({
        where: { submissionId: submissions.map((s) => s.id), isFinal: true, supersededAt: null },
        order: [['assessedAt', 'DESC']],
        transaction,
      })
    : [];
  const subById = new Map(submissions.map((s) => [s.id, s]));
  const finalAssessmentByTask = new Map();
  for (const a of assessments) {
    const taskId = subById.get(a.submissionId)?.taskId;
    if (taskId && !finalAssessmentByTask.has(taskId)) finalAssessmentByTask.set(taskId, a);
  }

  const results = calculateResults({ program: prog, enrollment, tasks, latestSubmissionByTask, finalAssessmentByTask, now });
  return { program: prog, tasks, submissions, latestSubmissionByTask, finalAssessmentByTask, results };
}

export async function loadHolidays(programId, transaction) {
  return InternshipHoliday.findAll({ where: { programId }, order: [['date', 'ASC']], transaction });
}
