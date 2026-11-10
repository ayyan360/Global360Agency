/**
 * Default internship program policies. Every program stores its own copy (JSONB) and these
 * defaults fill any missing keys. The certificate threshold lives on the program row
 * (certificateThreshold, default 70) and is the single authoritative value used everywhere.
 */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]; // ISO weekdays: Monday..Friday
export const DEFAULT_CERTIFICATE_THRESHOLD = 70;

export const DEFAULT_SCHEDULE_CONFIG = {
  releaseTime: '09:00', // local program time when a day's task becomes available
  dueTime: '23:59', // local program time the task is due
  dueOffsetDays: 0, // due on the same working day by default
  lateSubmissionPolicy: 'accept_flagged', // 'accept_flagged' | 'reject'
  allowEarlyAccess: false, // tasks are never visible/submittable before release unless enabled
  revisionGraceDays: 7, // revisions may still be submitted this many days after the program ends
  deadlineReminderHours: 12,
};

export const DEFAULT_SCORING_POLICY = {
  method: 'weighted_by_max_marks', // finalScore = Σ awarded / Σ max marks over required tasks × 100
  missingRequiredTask: 'zero', // unsubmitted required tasks stay in the denominator with 0 marks
  optionalTasks: 'excluded', // optional tasks never affect completion % or final score
  roundingDecimals: 2, // half-up rounding; the threshold is compared against the rounded score
};

export const DEFAULT_COMPLETION_RULES = {
  minCompletionPercent: 80, // share of required tasks that must be approved
  requireAllAssessmentsResolved: true, // no required task may be awaiting review/revision
};

export const DEFAULT_SUBMISSION_CONFIG = {
  allowedFileTypes: ['pdf', 'png', 'jpg', 'webp', 'zip'],
  maxFileSizeMB: 10,
  maxFiles: 5,
  allowResubmitBeforeReview: true, // a newer version supersedes a not-yet-reviewed one
  maxVersions: 5, // per task, including revisions
};

export const FILE_TYPE_MIME = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  webp: ['image/webp'],
  zip: ['application/zip', 'application/x-zip-compressed'],
};

export function programPolicy(program) {
  const p = typeof program.get === 'function' ? program.get({ plain: true }) : program;
  return {
    workingDays: Array.isArray(p.workingDays) && p.workingDays.length ? p.workingDays : DEFAULT_WORKING_DAYS,
    timezone: p.timezone || 'UTC',
    certificateThreshold: p.certificateThreshold === null || p.certificateThreshold === undefined ? DEFAULT_CERTIFICATE_THRESHOLD : Number(p.certificateThreshold),
    schedule: { ...DEFAULT_SCHEDULE_CONFIG, ...(p.scheduleConfig || {}) },
    scoring: { ...DEFAULT_SCORING_POLICY, ...(p.scoringPolicy || {}) },
    completion: { ...DEFAULT_COMPLETION_RULES, ...(p.completionRules || {}) },
    submission: { ...DEFAULT_SUBMISSION_CONFIG, ...(p.submissionConfig || {}) },
  };
}
