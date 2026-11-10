import { fileTypeFromBuffer } from 'file-type';
import {
  sequelize,
  CertificatePaymentRequest,
  CourseCertificate,
  CourseEnrollment,
  Course,
  InternshipCertificate,
  InternshipEnrollment,
  InternshipProgram,
  User,
} from '../models/index.js';
import { getSetting } from './settingsService.js';
import { audit } from './auditService.js';
import { notify } from './notificationService.js';
import { generateStorageKey, getStorage, requireStorage } from './storage/index.js';
import { toLimitOffset, pageMeta } from '../utils/pagination.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const RECEIPT_LIMIT = 5 * 1024 * 1024;
const RECEIPT_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function requestWhere(certificateType, certificateId) {
  return certificateType === 'course' ? { courseCertificateId: certificateId } : { internshipCertificateId: certificateId };
}

export async function certificatePaymentSummary({ certificateType, certificate, userId, fee }) {
  const amount = Number(fee || 0);
  const request = amount > 0
    ? await CertificatePaymentRequest.findOne({
        where: { ...requestWhere(certificateType, certificate.id), userId },
        attributes: ['id', 'status', 'reviewNote', 'createdAt', 'reviewedAt', 'feeAmount'],
      })
    : null;
  return {
    required: amount > 0,
    amount: request ? request.feeAmount : amount,
    currency: 'PKR',
    status: request?.status || null,
    reviewNote: request?.reviewNote || null,
    submittedAt: request?.createdAt || null,
    instructions: amount > 0 ? await getSetting('certificatePayments') : null,
  };
}

export async function assertCertificatePaymentApproved({ certificateType, certificate, userId, fee }) {
  if (Number(fee || 0) <= 0) return;
  const request = await CertificatePaymentRequest.findOne({
    where: { ...requestWhere(certificateType, certificate.id), userId },
    attributes: ['status'],
  });
  if (request?.status === 'approved') return;
  if (request?.status === 'pending') throw forbidden('Your payment receipt is being reviewed. Your certificate will be available after approval.');
  if (request?.status === 'rejected') throw forbidden('Your payment was not approved. Review the feedback and upload a new receipt.');
  throw forbidden('Submit the certificate fee payment receipt before downloading your certificate.');
}

async function ownedCertificate(certificateType, certificateId, userId) {
  if (certificateType === 'course') {
    const certificate = await CourseCertificate.findOne({
      where: { id: certificateId },
      include: [{
        model: CourseEnrollment,
        as: 'enrollment',
        where: { userId },
        include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'certificateFee'] }],
      }],
    });
    if (!certificate) throw notFound('Certificate not found.');
    return { certificate, fee: certificate.enrollment.course.certificateFee };
  }
  const certificate = await InternshipCertificate.findOne({
    where: { id: certificateId },
    include: [{
      model: InternshipEnrollment,
      as: 'enrollment',
      where: { userId },
      include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'certificateFee'] }],
    }],
  });
  if (!certificate || certificate.status !== 'valid') throw notFound('Certificate not found.');
  return { certificate, fee: certificate.enrollment.program.certificateFee };
}

async function validReceipt(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw badRequest('Choose a payment receipt image to upload.');
  if (!file.size || file.size > RECEIPT_LIMIT) throw unprocessable('Payment receipt images must be no larger than 5 MB.');
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !Object.values(RECEIPT_TYPES).includes(detected.mime)) {
    throw unprocessable('Upload a valid JPG, PNG, or WEBP payment receipt image.');
  }
  const ext = Object.keys(RECEIPT_TYPES).find((key) => RECEIPT_TYPES[key] === detected.mime);
  return { ext, mimeType: detected.mime };
}

export async function submitPaymentReceipt(user, certificateType, certificateId, file) {
  const { certificate, fee } = await ownedCertificate(certificateType, certificateId, user.id);
  if (Number(fee) <= 0) throw badRequest('This certificate does not require a payment.');
  const where = { ...requestWhere(certificateType, certificate.id), userId: user.id };
  const existing = await CertificatePaymentRequest.findOne({ where });
  if (existing?.status === 'approved') throw conflict('This certificate payment has already been approved.');
  if (existing?.status === 'pending') throw conflict('Your payment receipt is already awaiting review.');

  const { ext, mimeType } = await validReceipt(file);
  const storage = requireStorage();
  const storageKey = generateStorageKey(`certificate-payments/${user.id}`, ext);
  await storage.put(storageKey, file.buffer, mimeType);

  let oldStorageKey = null;
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const current = await CertificatePaymentRequest.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
      if (current?.status === 'approved') throw conflict('This certificate payment has already been approved.');
      if (current?.status === 'pending') throw conflict('Your payment receipt is already awaiting review.');

      let request;
      if (current) {
        oldStorageKey = current.receiptStorageKey;
        request = await current.update({
          receiptStorageKey: storageKey,
          receiptMimeType: mimeType,
          receiptSizeBytes: file.size,
          feeAmount: Number(fee),
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        }, { transaction });
      } else {
        request = await CertificatePaymentRequest.create({
          ...where,
          userId: user.id,
          certificateType,
          receiptStorageKey: storageKey,
          receiptMimeType: mimeType,
          receiptSizeBytes: file.size,
          feeAmount: Number(fee),
          status: 'pending',
        }, { transaction });
      }

      await notify({
        userId: user.id,
        type: 'certificate_payment_submitted',
        title: 'Payment receipt submitted',
        message: 'Our team will review your certificate payment within 24 hours. Your certificate will be available after approval.',
        resourceType: 'CertificatePaymentRequest',
        resourceId: request.id,
        link: '/student/certificates',
        dedupeKey: `certificate-payment-submitted:${request.id}:${request.updatedAt?.getTime() || Date.now()}`,
      }, { transaction });

      const admins = await User.findAll({
        where: { role: 'admin', accountStatus: 'active' },
        attributes: ['id'],
        transaction,
      });
      const certificateTitle = certificateType === 'course' ? certificate.courseTitle : certificate.programTitle;
      for (const admin of admins) {
        await notify({
          userId: admin.id,
          type: 'certificate_payment_submitted',
          title: 'Certificate payment receipt received',
          message: `${user.name} submitted a ${certificateType} certificate payment receipt for ${certificateTitle}. Review the receipt and payment details.`,
          resourceType: 'CertificatePaymentRequest',
          resourceId: request.id,
          link: '/admin/certificates',
          dedupeKey: `certificate-payment-receipt:${request.id}:${request.updatedAt?.getTime() || Date.now()}`,
        }, { transaction });
      }

      return { id: request.id, status: request.status, submittedAt: request.createdAt, reviewNote: request.reviewNote };
    });
    if (oldStorageKey) await storage.remove(oldStorageKey).catch((err) => logger.error({ err }, 'Previous certificate receipt cleanup failed'));
    return result;
  } catch (error) {
    await storage.remove(storageKey).catch((cleanupError) => logger.error({ err: cleanupError }, 'Uncommitted certificate receipt cleanup failed'));
    if (error.name === 'SequelizeUniqueConstraintError') throw conflict('A payment receipt has already been submitted for this certificate.');
    throw error;
  }
}

export async function listPaymentRequests({ status, certificateType, page = 1, pageSize = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (certificateType) where.certificateType = certificateType;
  const { rows, count } = await CertificatePaymentRequest.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      {
        model: CourseCertificate,
        as: 'courseCertificate',
        attributes: ['id', 'certificateNumber', 'courseTitle'],
        include: [{ model: CourseEnrollment, as: 'enrollment', attributes: ['id'], include: [{ model: Course, as: 'course', attributes: ['id', 'certificateFee'] }] }],
      },
      {
        model: InternshipCertificate,
        as: 'internshipCertificate',
        attributes: ['id', 'certificateNumber', 'programTitle', 'status'],
        include: [{ model: InternshipEnrollment, as: 'enrollment', attributes: ['id'], include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'certificateFee'] }] }],
      },
    ],
    order: [['createdAt', 'DESC']],
    distinct: true,
    ...toLimitOffset({ page, pageSize }),
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      certificateType: row.certificateType,
      status: row.status,
      reviewNote: row.reviewNote,
      submittedAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      receiptMimeType: row.receiptMimeType,
      receiptSizeBytes: row.receiptSizeBytes,
      feeAmount: row.feeAmount,
      receiptUrl: `/api/admin/certificate-payments/${row.id}/receipt`,
      user: row.user,
      certificate: row.certificateType === 'course'
        ? { id: row.courseCertificate.id, number: row.courseCertificate.certificateNumber, title: row.courseCertificate.courseTitle, fee: row.feeAmount }
        : { id: row.internshipCertificate.id, number: row.internshipCertificate.certificateNumber, title: row.internshipCertificate.programTitle, fee: row.feeAmount },
    })),
    meta: pageMeta({ page, pageSize }, count),
  };
}

export async function getPaymentReceiptForAdmin(requestId) {
  const request = await CertificatePaymentRequest.findByPk(requestId);
  if (!request) throw notFound('Payment receipt not found.');
  const storage = getStorage();
  if (!storage) throw notFound('Payment receipt file is unavailable.');
  return {
    stream: await storage.getStream(request.receiptStorageKey),
    mimeType: request.receiptMimeType,
    sizeBytes: request.receiptSizeBytes,
  };
}

export async function reviewPaymentRequest(admin, requestId, { decision, note }, { ip } = {}) {
  return sequelize.transaction(async (transaction) => {
    const request = await CertificatePaymentRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw notFound('Payment request not found.');
    if (request.status !== 'pending') throw conflict('This payment request has already been reviewed.');

    await request.update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
    }, { transaction });

    const approved = decision === 'approve';
    await notify({
      userId: request.userId,
      type: approved ? 'certificate_payment_approved' : 'certificate_payment_rejected',
      title: approved ? 'Certificate payment approved' : 'Certificate payment needs attention',
      message: approved
        ? 'Your certificate payment has been approved. Your certificate is now ready to view and download.'
        : `Your certificate payment was not approved. ${note.trim()} Please submit a new receipt after correcting it.`,
      resourceType: 'CertificatePaymentRequest',
      resourceId: request.id,
      link: '/student/certificates',
    }, { transaction });
    await audit({
      actorId: admin.id,
      action: approved ? 'certificate_payment.approved' : 'certificate_payment.rejected',
      entityType: 'CertificatePaymentRequest',
      entityId: request.id,
      metadata: { certificateType: request.certificateType, decision },
      ip,
      transaction,
    });

    return { id: request.id, status: request.status, reviewedAt: request.reviewedAt, reviewNote: request.reviewNote };
  });
}
