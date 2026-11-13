import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import {
  uuid,
  optionalUrl,
  trimmed,
  optionalText,
  isoDate,
  optionalDateTime,
  stringList,
  password,
  email,
  boolQuery,
} from './common.js';
import { COURSE_LEVELS, COURSE_STATUSES } from '../models/learning.js';
import { ROLES, ACCOUNT_STATUSES } from '../models/User.js';
import { APPLICATION_STATUSES, ENROLLMENT_STATUSES, SUBMISSION_STATUSES, PROGRAM_STATUSES, TASK_STATUSES } from '../models/internship.js';

/**
 * PATCH schemas must not apply defaults (Zod applies .default() even inside .partial()),
 * otherwise omitted fields would be silently reset. This unwraps defaults, then makes all keys optional.
 */
export function updateSchema(objectSchema) {
  const shape = {};
  for (const [key, field] of Object.entries(objectSchema.shape)) {
    shape[key] = field instanceof z.ZodDefault ? field.unwrap() : field;
  }
  return z.object(shape).partial();
}

// ---------- Auth & profile ----------
export const registerBody = z.object({
  name: trimmed(2, 120, 'Name'),
  email,
  password,
});
export const certificatePaymentListQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  certificateType: z.enum(['course', 'internship']).optional(),
  ...paginationQuery,
});
export const certificatePaymentReviewBody = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).optional(),
}).refine((value) => value.decision !== 'reject' || (value.note && value.note.length >= 5), {
  message: 'A reason of at least 5 characters is required when rejecting a payment.',
  path: ['note'],
});
export const loginBody = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });
export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
export const profileBody = z.object({
  name: trimmed(2, 120, 'Name').optional(),
  phone: optionalText(40),
  headline: optionalText(160),
  bio: optionalText(2000),
  avatarUrl: optionalUrl,
  preferences: z.object({ emailNotifications: z.boolean().optional(), weeklySummary: z.boolean().optional() }).optional(),
});

// ---------- Courses ----------
export const courseListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(['newest', 'popular', 'rating', 'title']).default('newest'),
  ...paginationQuery,
});
export const reviewBody = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: optionalText(2000) });
export const lessonCompleteBody = z.object({ completed: z.boolean().default(true) });
export const aiAssistantBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      })
    )
    .min(1)
    .max(10),
  pageContext: z.enum([
    'student_dashboard',
    'student_courses',
    'learning_progress',
    'lesson_player',
    'internship_dashboard',
    'internship_tasks',
    'internship_progress',
    'certificates',
    'profile',
    'notifications',
    'course_catalog',
    'course_details',
    'internship_catalog',
    'internship_details',
    'internship_application',
    'certificate_verification',
    'sign_in',
    'admin_dashboard',
    'admin_courses',
    'admin_curriculum',
    'admin_learners',
    'admin_programs',
    'admin_applications',
    'admin_participants',
    'admin_tasks',
    'admin_reviews',
    'admin_certificates',
    'admin_settings',
    'admin_area',
    'other',
  ]).default('other'),
});

// ---------- Contact ----------
export const contactBody = z.object({
  name: trimmed(2, 120, 'Name'),
  email,
  subject: trimmed(3, 200, 'Subject'),
  message: trimmed(10, 5000, 'Message'),
  website: z.string().max(0).optional(), // honeypot: must be empty
});

// ---------- Internship (student) ----------
export const applicationBody = z.object({
  fullName: trimmed(2, 120, 'Full name'),
  phone: optionalText(40).refine((v) => v === null || /^[+\d][\d\s()-]{5,39}$/.test(v), { message: 'Enter a valid phone number' }),
  education: optionalText(300),
  experience: optionalText(3000),
  skills: optionalText(1000),
  motivation: trimmed(30, 4000, 'Motivation'),
  portfolioUrl: optionalUrl,
  agreeToTerms: z.literal(true, { error: 'Please confirm the program requirements' }).optional(),
});
export const submissionBody = z.object({
  submissionText: optionalText(20000),
  repositoryUrl: optionalUrl,
  liveUrl: optionalUrl,
});
export const weekQuery = z.object({ week: z.coerce.number().int().min(1).max(60).optional() });
export const withdrawBody = z.object({ reason: optionalText(500) });

// ---------- Notifications ----------
export const notificationQuery = z.object({ unreadOnly: boolQuery, ...paginationQuery });

// ---------- Admin: users ----------
export const adminUserQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  ...paginationQuery,
});
export const adminUserUpdateBody = z.object({
  role: z.enum(ROLES).optional(),
  accountStatus: z.enum(ACCOUNT_STATUSES).optional(),
  name: trimmed(2, 120, 'Name').optional(),
});
export const adminCreateUserBody = z.object({
  name: trimmed(2, 120, 'Name'),
  email,
  password,
  role: z.enum(['instructor', 'reviewer', 'admin']),
});

// ---------- Admin: courses ----------
const courseFields = {
  title: trimmed(3, 160, 'Title'),
  slug: z.string().trim().max(180).regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens').optional(),
  shortDescription: trimmed(10, 300, 'Short description'),
  description: trimmed(20, 20000, 'Description'),
  thumbnailUrl: optionalUrl,
  category: trimmed(2, 80, 'Category'),
  level: z.enum(COURSE_LEVELS),
  status: z.enum(COURSE_STATUSES),
  instructorId: uuid.nullable().optional(),
  outcomes: stringList(20, 300).default([]),
  requirements: stringList(20, 300).default([]),
  language: trimmed(2, 40, 'Language').default('English'),
  isFree: z.boolean().default(true),
  certificateFee: z.coerce.number().int().min(0).max(10000000).default(0),
};
export const courseCreateBody = z.object(courseFields);
export const courseUpdateBody = updateSchema(z.object(courseFields));
export const adminCourseQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  ...paginationQuery,
});
export const moduleBody = z.object({ title: trimmed(2, 160, 'Title'), description: optionalText(2000), position: z.coerce.number().int().min(0).optional() });
export const lessonBody = z.object({
  title: trimmed(2, 160, 'Title'),
  description: optionalText(10000),
  videoUrl: optionalUrl,
  durationSeconds: z.coerce.number().int().min(0).max(86400).default(0),
  isPreview: z.boolean().default(false),
  position: z.coerce.number().int().min(0).optional(),
  moduleId: uuid.optional(),
});
export const reorderBody = z.object({ orderedIds: z.array(uuid).min(1).max(500) });
export const enrollmentListQuery = z.object({ search: z.string().trim().max(100).optional(), courseId: uuid.optional(), status: z.enum(['active', 'completed', 'cancelled']).optional(), ...paginationQuery });

// ---------- Admin: internships ----------
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');
export const programBody = z.object({
  title: trimmed(3, 160, 'Title'),
  slug: z.string().trim().max(180).regex(/^[a-z0-9-]*$/).optional(),
  shortDescription: trimmed(10, 300, 'Short description'),
  description: trimmed(20, 20000, 'Description'),
  track: trimmed(2, 80, 'Track'),
  durationMonths: z.coerce.number().int().min(1).max(24).default(3),
  durationWeeks: z.coerce.number().int().min(1).max(104).default(12),
  startDate: isoDate,
  endDate: isoDate,
  applicationOpenAt: optionalDateTime,
  applicationCloseAt: optionalDateTime,
  capacity: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  certificateFee: z.coerce.number().int().min(0).max(10000000).default(0),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).default([1, 2, 3, 4, 5]),
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  certificateThreshold: z.coerce.number().min(0).max(100).default(70),
  scheduleConfig: z
    .object({
      releaseTime: timeOfDay.optional(),
      dueTime: timeOfDay.optional(),
      dueOffsetDays: z.number().int().min(0).max(14).optional(),
      lateSubmissionPolicy: z.enum(['accept_flagged', 'reject']).optional(),
      allowEarlyAccess: z.boolean().optional(),
      revisionGraceDays: z.number().int().min(0).max(60).optional(),
      deadlineReminderHours: z.number().int().min(1).max(168).optional(),
    })
    .default({}),
  scoringPolicy: z
    .object({
      method: z.literal('weighted_by_max_marks').optional(),
      missingRequiredTask: z.literal('zero').optional(),
      optionalTasks: z.literal('excluded').optional(),
      roundingDecimals: z.number().int().min(0).max(4).optional(),
    })
    .default({}),
  completionRules: z
    .object({
      minCompletionPercent: z.number().min(0).max(100).optional(),
      requireAllAssessmentsResolved: z.literal(true).optional(),
    })
    .default({}),
  submissionConfig: z
    .object({
      allowedFileTypes: z.array(z.enum(['pdf', 'png', 'jpg', 'webp', 'zip'])).min(1).optional(),
      maxFileSizeMB: z.number().min(1).max(25).optional(),
      maxFiles: z.number().int().min(1).max(10).optional(),
      allowResubmitBeforeReview: z.boolean().optional(),
      maxVersions: z.number().int().min(1).max(20).optional(),
    })
    .default({}),
  objectives: stringList(20).default([]),
  skills: stringList(30, 80).default([]),
  eligibility: stringList(20).default([]),
  weeklyCurriculum: z.array(z.object({ week: z.number().int().min(1).max(104), title: trimmed(2, 160, 'Week title'), summary: optionalText(1000) })).max(104).default([]),
  status: z.enum(PROGRAM_STATUSES).default('draft'),
  confirmScheduleChange: z.boolean().optional(),
});
export const programUpdateBody = updateSchema(programBody);
export const programListQuery = z.object({ search: z.string().trim().max(100).optional(), status: z.enum(PROGRAM_STATUSES).optional(), ...paginationQuery });
export const holidayBody = z.object({ date: isoDate, name: trimmed(2, 120, 'Name') });
export const reviewerAssignBody = z.object({ reviewerId: uuid, enrollmentId: uuid.nullable().optional() });

const taskFields = {
  title: trimmed(3, 200, 'Title'),
  description: trimmed(10, 5000, 'Description'),
  instructions: trimmed(10, 20000, 'Instructions'),
  requirements: stringList(30).default([]),
  acceptanceCriteria: stringList(30).default([]),
  skills: stringList(20, 80).default([]),
  resources: z.array(z.object({ label: trimmed(1, 160, 'Label'), url: optionalUrl.refine((v) => v !== null, 'URL required') })).max(20).default([]),
  submissionTypes: z.array(z.enum(['text', 'repository', 'live', 'file'])).min(1).default(['text', 'repository', 'live', 'file']),
  maxMarks: z.coerce.number().int().min(1).max(1000).default(10),
  isRequired: z.boolean().default(true),
};
const scheduleFields = {
  scheduledDate: isoDate.optional(),
  weekNumber: z.coerce.number().int().min(1).max(104).optional(),
  scheduledDay: z.coerce.number().int().min(1).max(7).optional(),
  availableAt: z.iso.datetime({ offset: true }).optional(),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  allowNonWorkingDay: z.boolean().optional(),
};
export const taskCreateBody = z.object({ ...taskFields, ...scheduleFields, status: z.enum(['draft', 'published']).default('draft') });
export const taskUpdateBody = updateSchema(z.object({ ...taskFields, ...scheduleFields, changeReason: optionalText(500) }));
export const taskStatusBody = z.object({ status: z.enum(TASK_STATUSES) });
export const taskListQuery = z.object({
  programId: uuid.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  week: z.coerce.number().int().min(1).max(104).optional(),
  search: z.string().trim().max(100).optional(),
  page: paginationQuery.page,
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export const taskPlanBody = z.object({
  publish: z.boolean().default(false),
  plan: z.array(z.object({ ...taskFields, weekNumber: z.number().int().min(1).max(104).optional(), scheduledDay: z.number().int().min(1).max(7).optional(), scheduledDate: isoDate.optional() })).min(1).max(400),
});

export const applicationListQuery = z.object({
  programId: uuid.optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationQuery,
});
export const applicationDecisionBody = z.object({
  status: z.enum(['under_review', 'approved', 'rejected', 'waitlisted']),
  publicFeedback: optionalText(2000),
  internalNotes: optionalText(5000),
});
export const enrollmentAdminQuery = z.object({
  programId: uuid.optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationQuery,
});
export const enrollmentStatusBody = z.object({ status: z.enum(['in_progress', 'withdrawn', 'suspended']), reason: optionalText(500) });

export const reviewQueueQuery = z.object({
  programId: uuid.optional(),
  taskId: uuid.optional(),
  participant: z.string().trim().max(100).optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  assignedToMe: boolQuery,
  submittedFrom: isoDate.optional(),
  submittedTo: isoDate.optional(),
  dueBefore: isoDate.optional(),
  sort: z.enum(['oldest', 'newest']).default('oldest'),
  ...paginationQuery,
});
export const assessmentBody = z.object({
  decision: z.enum(['approve', 'request_revision', 'reject']),
  marksAwarded: z.coerce.number().min(0).max(1000).nullable().optional(),
  feedback: trimmed(5, 10000, 'Feedback'),
});
export const amendmentBody = z.object({
  decision: z.enum(['approve', 'reject']),
  marksAwarded: z.coerce.number().min(0).max(1000),
  feedback: trimmed(5, 10000, 'Feedback'),
  reason: trimmed(5, 1000, 'Reason'),
});
export const certificateListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['valid', 'revoked']).optional(),
  programId: uuid.optional(),
  ...paginationQuery,
});
export const revokeBody = z.object({ reason: trimmed(5, 1000, 'Reason') });

export const messageListQuery = z.object({ status: z.enum(['new', 'read', 'archived']).optional(), search: z.string().trim().max(100).optional(), ...paginationQuery });
export const messageStatusBody = z.object({ status: z.enum(['new', 'read', 'archived']) });
export const auditQuery = z.object({ entityType: z.string().trim().max(60).optional(), action: z.string().trim().max(80).optional(), page: paginationQuery.page, pageSize: z.coerce.number().int().min(1).max(50).default(30) });
export const settingsBody = z.object({
  contact: z.object({ email: z.union([z.literal(''), email]).optional(), phone: z.string().trim().max(40).optional(), address: z.string().trim().max(300).optional(), hours: z.string().trim().max(120).optional() }).optional(),
  social: z.object(Object.fromEntries(['facebook', 'linkedin', 'x', 'youtube', 'instagram', 'github'].map((k) => [k, z.union([z.literal(''), optionalUrl.refine((v) => v !== null)]).optional()]))).optional(),
  site: z.object({ tagline: z.string().trim().max(200).optional(), supportEmail: z.union([z.literal(''), email]).optional() }).optional(),
  certificatePayments: z.object({
    bankName: z.string().trim().max(100).optional(),
    accountHolder: z.string().trim().max(120).optional(),
    accountNumber: z.string().trim().max(80).optional(),
  }).optional(),
});
