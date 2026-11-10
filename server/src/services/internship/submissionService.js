import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { Op } from 'sequelize';
import {
  sequelize,
  InternshipTask,
  InternshipEnrollment,
  InternshipReviewerAssignment,
  TaskSubmission,
  SubmissionAttachment,
  TaskAssessment,
  TaskReviewHistory,
  User,
} from '../../models/index.js';
import { notFound, badRequest, conflict, unprocessable } from '../../utils/errors.js';
import { requireStorage, generateStorageKey, getStorage } from '../storage/index.js';
import { notify } from '../notificationService.js';
import { logger } from '../../utils/logger.js';
import { programPolicy, FILE_TYPE_MIME } from './policy.js';
import { getParticipantEnrollment, submissionEligibility } from './taskService.js';

/** Absolute upper bound enforced by the upload middleware, regardless of program config. */
export const HARD_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const HARD_MAX_FILES = 10;

/**
 * Validates uploaded files against the program policy using the file's actual bytes
 * (magic numbers), its extension and size. Browser-supplied MIME types are not trusted.
 */
export async function validateUploads(files, policy) {
  const { allowedFileTypes, maxFileSizeMB, maxFiles } = policy.submission;
  if (files.length > maxFiles) throw unprocessable(`You can attach up to ${maxFiles} files.`);
  const out = [];
  for (const file of files) {
    const original = path.basename(String(file.originalname || 'file')).replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'file';
    const ext = path.extname(original).slice(1).toLowerCase();
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    if (file.size > maxFileSizeMB * 1024 * 1024) throw unprocessable(`"${original}" exceeds the ${maxFileSizeMB} MB limit.`);
    if (file.size === 0) throw unprocessable(`"${original}" is empty.`);
    if (!allowedFileTypes.includes(normalizedExt)) {
      throw unprocessable(`"${original}" is not an accepted file type. Allowed: ${allowedFileTypes.join(', ').toUpperCase()}.`);
    }
    const detected = await fileTypeFromBuffer(file.buffer);
    const allowedMimes = FILE_TYPE_MIME[normalizedExt] || [];
    if (!detected || !allowedMimes.includes(detected.mime)) {
      throw unprocessable(`"${original}" does not appear to be a valid ${normalizedExt.toUpperCase()} file.`);
    }
    out.push({ buffer: file.buffer, originalFileName: original, ext: normalizedExt, mimeType: detected.mime, sizeBytes: file.size });
  }
  return out;
}

function validateContentAgainstTask(task, { submissionText, repositoryUrl, liveUrl }, files) {
  const types = task.submissionTypes || [];
  if (submissionText && !types.includes('text')) throw unprocessable('This task does not accept a written explanation.');
  if (repositoryUrl && !types.includes('repository')) throw unprocessable('This task does not accept a repository link.');
  if (liveUrl && !types.includes('live')) throw unprocessable('This task does not accept a live project link.');
  if (files.length && !types.includes('file')) throw unprocessable('This task does not accept file uploads.');
  if (!submissionText && !repositoryUrl && !liveUrl && !files.length) {
    throw unprocessable('Add at least one of: a written explanation, a link, or a file.');
  }
}

export async function createSubmission(user, taskId, body, files = []) {
  const enrollment = await getParticipantEnrollment(user);
  const program = enrollment.program;
  const task = await InternshipTask.findOne({ where: { id: taskId, programId: enrollment.programId } });
  if (!task || task.status !== 'published') throw notFound('Task not found.');
  const policy = programPolicy(program);

  validateContentAgainstTask(task, body, files);
  const validFiles = files.length ? await validateUploads(files, policy) : [];
  const storage = validFiles.length ? requireStorage() : null;

  // Store files first with unguessable keys; remove them if the database transaction fails.
  const stored = [];
  try {
    for (const f of validFiles) {
      const key = generateStorageKey(`submissions/${enrollment.id}`, f.ext);
      await storage.put(key, f.buffer, f.mimeType);
      stored.push({ ...f, storageKey: key });
    }

    const result = await sequelize.transaction(async (transaction) => {
      // Lock this participant's existing versions for the task to serialize concurrent submissions.
      await InternshipEnrollment.findByPk(enrollment.id, { transaction, lock: transaction.LOCK.UPDATE });
      const versions = await TaskSubmission.findAll({
        where: { taskId, enrollmentId: enrollment.id },
        order: [['version', 'DESC']],
        transaction,
      });
      const latest = versions.find((v) => v.status !== 'superseded') || null;
      const now = new Date();
      const { canSubmit, reason } = await submissionEligibility({ enrollment, program, task, latest, now });
      if (!canSubmit) throw conflict(reason, { code: 'SUBMISSION_NOT_ALLOWED' });

      const version = (versions[0]?.version || 0) + 1;
      if (latest && latest.status === 'submitted') {
        await latest.update({ status: 'superseded' }, { transaction });
        await TaskReviewHistory.create(
          { submissionId: latest.id, reviewerId: user.id, previousStatus: 'submitted', newStatus: 'superseded', action: 'superseded_by_resubmission' },
          { transaction }
        );
      }
      const submission = await TaskSubmission.create(
        {
          taskId,
          enrollmentId: enrollment.id,
          version,
          submissionText: body.submissionText || null,
          repositoryUrl: body.repositoryUrl || null,
          liveUrl: body.liveUrl || null,
          status: 'submitted',
          isLate: now > new Date(task.dueAt),
          submittedAt: now,
        },
        { transaction }
      );
      for (const f of stored) {
        await SubmissionAttachment.create(
          { submissionId: submission.id, storageKey: f.storageKey, originalFileName: f.originalFileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes },
          { transaction }
        );
      }
      await TaskReviewHistory.create(
        {
          submissionId: submission.id,
          reviewerId: user.id,
          previousStatus: latest?.status === 'revision_required' ? 'revision_required' : null,
          newStatus: 'submitted',
          action: latest?.status === 'revision_required' ? 'revision_submitted' : version > 1 ? 'resubmitted' : 'submitted',
        },
        { transaction }
      );

      await notify(
        {
          userId: user.id,
          type: 'submission_received',
          title: 'Submission received',
          message: `Your submission (version ${version}) for "${task.title}" was received and is awaiting review.`,
          resourceType: 'TaskSubmission',
          resourceId: submission.id,
          link: `/student/internship/tasks/${task.id}`,
          dedupeKey: `submission-received:${submission.id}`,
        },
        { transaction }
      );
      const reviewers = await InternshipReviewerAssignment.findAll({
        where: { programId: program.id, [Op.or]: [{ enrollmentId: null }, { enrollmentId: enrollment.id }] },
        attributes: ['reviewerId'],
        transaction,
      });
      for (const reviewerId of new Set(reviewers.map((r) => r.reviewerId))) {
        await notify(
          {
            userId: reviewerId,
            type: 'submission_to_review',
            title: 'New submission to review',
            message: `${user.name} submitted "${task.title}" (version ${version}).`,
            resourceType: 'TaskSubmission',
            resourceId: submission.id,
            link: `/admin/reviews/${submission.id}`,
            dedupeKey: `submission-to-review:${submission.id}`,
          },
          { transaction }
        );
      }
      return submission;
    });
    return getSubmissionHistoryForParticipant(user, taskId).then((h) => ({ submission: h.find((s) => s.id === result.id), history: h }));
  } catch (err) {
    for (const f of stored) await storage.remove(f.storageKey).catch((e) => logger.warn({ e }, 'Orphan cleanup failed'));
    throw err;
  }
}

function serializeSubmissionForParticipant(s) {
  return {
    id: s.id,
    version: s.version,
    status: s.status,
    submissionText: s.submissionText,
    repositoryUrl: s.repositoryUrl,
    liveUrl: s.liveUrl,
    isLate: s.isLate,
    submittedAt: s.submittedAt,
    attachments: (s.attachments || []).map((a) => ({ id: a.id, originalFileName: a.originalFileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
    assessments: (s.assessments || [])
      .sort((a, b) => new Date(b.assessedAt) - new Date(a.assessedAt))
      .map((a) => ({
        id: a.id,
        decision: a.decision,
        marksAwarded: a.marksAwarded,
        feedback: a.feedback,
        isFinal: a.isFinal,
        assessedAt: a.assessedAt,
        superseded: Boolean(a.supersededAt),
        reviewer: a.reviewer ? { name: a.reviewer.name } : null,
      })),
  };
}

export async function getSubmissionHistoryForParticipant(user, taskId) {
  const enrollment = await getParticipantEnrollment(user);
  const task = await InternshipTask.findOne({ where: { id: taskId, programId: enrollment.programId } });
  if (!task) throw notFound('Task not found.');
  const rows = await TaskSubmission.findAll({
    where: { taskId, enrollmentId: enrollment.id },
    include: [
      { model: SubmissionAttachment, as: 'attachments' },
      { model: TaskAssessment, as: 'assessments', include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }] },
    ],
    order: [['version', 'DESC']],
  });
  return rows.map(serializeSubmissionForParticipant);
}

/** Can this user view a submission (owner, assigned reviewer, or admin)? */
export async function canAccessSubmission(user, submission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const enrollment = submission.enrollment || (await InternshipEnrollment.findByPk(submission.enrollmentId));
  if (enrollment.userId === user.id) return true;
  if (user.role === 'reviewer') return isAssignedReviewer(user.id, enrollment);
  return false;
}

export async function isAssignedReviewer(reviewerId, enrollment) {
  const row = await InternshipReviewerAssignment.findOne({
    where: { reviewerId, programId: enrollment.programId, [Op.or]: [{ enrollmentId: null }, { enrollmentId: enrollment.id }] },
    attributes: ['id'],
  });
  return Boolean(row);
}

/** Returns either a signed URL (object storage) or a readable stream (local storage) for an attachment. */
export async function getAttachmentForUser(user, attachmentId) {
  const attachment = await SubmissionAttachment.findByPk(attachmentId, {
    include: [{ model: TaskSubmission, as: 'submission', include: [{ model: InternshipEnrollment, as: 'enrollment' }] }],
  });
  if (!attachment) throw notFound('File not found.');
  if (!(await canAccessSubmission(user, attachment.submission))) throw notFound('File not found.');
  const storage = getStorage();
  if (!storage) throw badRequest('File storage is not configured.');
  const signedUrl = await storage.getSignedUrl(attachment.storageKey, { downloadName: attachment.originalFileName, contentType: attachment.mimeType });
  if (signedUrl) return { attachment, signedUrl };
  const stream = await storage.getStream(attachment.storageKey).catch(() => {
    throw notFound('File is no longer available.');
  });
  return { attachment, stream };
}

