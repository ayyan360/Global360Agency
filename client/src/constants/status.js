/** Status → label & badge tone for every workflow state shown in the UI. */
export const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-amber-700',
  danger: 'bg-danger-light text-danger',
  info: 'bg-sky-50 text-sky-700',
};

export const STATUS = {
  // Courses / enrollments
  draft: ['Draft', 'neutral'],
  published: ['Published', 'success'],
  archived: ['Archived', 'neutral'],
  active: ['Active', 'success'],
  completed: ['Completed', 'primary'],
  cancelled: ['Cancelled', 'neutral'],
  // Applications
  pending: ['Pending', 'warning'],
  under_review: ['Under Review', 'info'],
  approved: ['Approved', 'success'],
  rejected: ['Rejected', 'danger'],
  waitlisted: ['Waitlisted', 'neutral'],
  withdrawn: ['Withdrawn', 'neutral'],
  // Internship enrollment
  in_progress: ['In Progress', 'primary'],
  completed_qualified: ['Completed — Qualified', 'success'],
  completed_not_qualified: ['Completed — Not Qualified', 'danger'],
  suspended: ['Suspended', 'danger'],
  // Participant task states
  scheduled: ['Scheduled', 'neutral'],
  available: ['Available', 'primary'],
  submitted: ['Submitted', 'info'],
  revision_required: ['Revision Required', 'warning'],
  overdue: ['Overdue', 'danger'],
  superseded: ['Superseded', 'neutral'],
  // Certificates / messages / accounts
  valid: ['Valid', 'success'],
  revoked: ['Revoked', 'danger'],
  new: ['New', 'primary'],
  read: ['Read', 'neutral'],
  deactivated: ['Deactivated', 'neutral'],
  // Outcomes
  qualified: ['Qualified', 'success'],
  not_qualified: ['Not Qualified', 'danger'],
  awaiting_assessments: ['Awaiting Assessments', 'warning'],
  ineligible: ['Not Eligible', 'neutral'],
};

export function statusInfo(status) {
  const [label, tone] = STATUS[status] || [String(status || '—').replace(/_/g, ' '), 'neutral'];
  return { label, tone, className: TONES[tone] };
}

export const DECISION_LABELS = { approve: 'Approved', request_revision: 'Revision requested', reject: 'Rejected' };
export const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
