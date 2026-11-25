import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { sequelize, InternshipTask, InternshipTaskAttachment } from '../../models/index.js';
import { badRequest, notFound, unprocessable } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { audit } from '../auditService.js';
import { generateStorageKey, getStorage, requireStorage } from '../storage/index.js';

export const MAX_TASK_PDF_BYTES = 10 * 1024 * 1024;

export async function validateTaskPdf(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw badRequest('Choose a PDF file to attach to this task.');
  if (!file.size || file.size > MAX_TASK_PDF_BYTES) throw unprocessable('Task PDFs must be between 1 byte and 10 MB.');

  const originalFileName = path.basename(String(file.originalname || 'task-brief.pdf'))
    .replace(/[^\w.\- ()]/g, '_')
    .slice(0, 200) || 'task-brief.pdf';
  const detected = await fileTypeFromBuffer(file.buffer);
  if (path.extname(originalFileName).toLowerCase() !== '.pdf' || detected?.mime !== 'application/pdf') {
    throw unprocessable('Upload a valid PDF file.');
  }

  return { originalFileName, mimeType: 'application/pdf', sizeBytes: file.size };
}

export function serializeTaskAttachment(attachment) {
  if (!attachment) return null;
  const value = attachment.get ? attachment.get({ plain: true }) : attachment;
  return {
    id: value.id,
    originalFileName: value.originalFileName,
    mimeType: value.mimeType,
    sizeBytes: Number(value.sizeBytes),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export async function uploadTaskPdf(admin, taskId, file, { ip } = {}) {
  const task = await InternshipTask.findByPk(taskId);
  if (!task) throw notFound('Task not found.');
  const metadata = await validateTaskPdf(file);
  const storage = requireStorage();
  const storageKey = generateStorageKey(`internship-tasks/${taskId}`, 'pdf');
  await storage.put(storageKey, file.buffer, metadata.mimeType);

  let uploaded;
  try {
    uploaded = await sequelize.transaction(async (transaction) => {
      const existing = await InternshipTaskAttachment.findOne({ where: { taskId }, transaction, lock: transaction.LOCK.UPDATE });
      const previousStorageKey = existing?.storageKey;
      const attachment = existing
        ? await existing.update({ ...metadata, storageKey }, { transaction })
        : await InternshipTaskAttachment.create({ taskId, ...metadata, storageKey }, { transaction });
      await audit({
        actorId: admin.id,
        action: 'task.pdf_uploaded',
        entityType: 'InternshipTask',
        entityId: taskId,
        metadata: { fileName: metadata.originalFileName, sizeBytes: metadata.sizeBytes },
        ip,
        transaction,
      });
      return { attachment, previousStorageKey };
    });
  } catch (error) {
    await storage.remove(storageKey).catch((cleanupError) => logger.warn({ cleanupError, storageKey }, 'Task PDF upload cleanup failed'));
    throw error;
  }

  if (uploaded.previousStorageKey) {
    await storage.remove(uploaded.previousStorageKey).catch((error) => logger.warn({ error, storageKey: uploaded.previousStorageKey }, 'Replaced task PDF cleanup failed'));
  }
  return serializeTaskAttachment(uploaded.attachment);
}

export async function getStoredTaskPdf(attachment) {
  if (!attachment) throw notFound('Task PDF not found.');
  const file = attachment.get ? attachment.get({ plain: true }) : attachment;
  const storage = requireStorage();
  const signedUrl = await storage.getSignedUrl(file.storageKey, {
    downloadName: file.originalFileName,
    contentType: file.mimeType,
  });
  if (signedUrl) return { attachment: file, signedUrl };

  let stream;
  try {
    stream = await storage.getStream(file.storageKey);
  } catch (error) {
    if (error.code === 'ENOENT' || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      throw notFound('Task PDF is no longer available.');
    }
    throw error;
  }
  return { attachment: file, stream };
}

export async function removeStoredTaskPdfs(attachments) {
  if (!attachments.length) return;
  const storage = getStorage();
  if (!storage) {
    logger.warn({ taskIds: attachments.map((attachment) => attachment.taskId) }, 'Task PDFs could not be removed because file storage is unavailable');
    return;
  }
  for (const attachment of attachments) {
    await storage.remove(attachment.storageKey).catch((error) => logger.warn({ error, storageKey: attachment.storageKey }, 'Task PDF cleanup failed'));
  }
}

export async function getTaskPdfForAdmin(taskId) {
  const attachment = await InternshipTaskAttachment.findOne({ where: { taskId } });
  return getStoredTaskPdf(attachment);
}
