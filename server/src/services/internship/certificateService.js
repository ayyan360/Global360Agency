import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import { Op } from 'sequelize';
import {
  sequelize,
  Course,
  CourseCertificate,
  CourseEnrollment,
  InternshipEnrollment,
  InternshipProgram,
  CertificatePaymentRequest,
  InternshipCertificate,
  User,
} from '../../models/index.js';
import { loadEnrollmentResults } from './scoringService.js';
import { renderCertificatePdf } from './certificatePdf.js';
import { getStorage, generateStorageKey } from '../storage/index.js';
import { notify } from '../notificationService.js';
import { audit } from '../auditService.js';
import { notFound, forbidden, badRequest, conflict } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { programPolicy } from './policy.js';
import { assertCertificatePaymentApproved } from '../certificatePaymentService.js';

export function generateCertificateNumber(date = new Date()) {
  // e.g. G360-2026-7F3K9QX2 — unguessable, human-readable (no 0/O/1/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `G360-${date.getUTCFullYear()}-${s}`;
}

/**
 * Evaluate an enrollment and, if appropriate, complete it and issue its certificate.
 * Safe to call repeatedly (idempotent):
 *  - the enrollment row is locked for the duration of the transaction;
 *  - certificates are unique per enrollment (DB constraint) and only created once;
 *  - nothing is finalized while required assessments are unresolved or before the end date.
 */
export async function evaluateEnrollment(enrollmentId, { actorId = null, ip = null, now = new Date() } = {}) {
  const outcome = await sequelize.transaction(async (transaction) => {
    const enrollment = await InternshipEnrollment.findByPk(enrollmentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!enrollment) throw notFound('Enrollment not found.');
    const program = await InternshipProgram.findByPk(enrollment.programId, { transaction });
    const { results } = await loadEnrollmentResults(enrollment, { program, transaction, now });

    const existing = await InternshipCertificate.findOne({ where: { enrollmentId }, transaction });
    let certificate = existing;
    let issued = false;
    let statusChanged = false;

    if (results.outcome === 'qualified') {
      if (enrollment.status !== 'completed_qualified') {
        await enrollment.update(
          {
            status: 'completed_qualified',
            finalScore: results.finalScore,
            completionProgress: results.completionProgress,
            completedAt: enrollment.completedAt || now,
            evaluatedAt: now,
            statusReason: null,
          },
          { transaction }
        );
        statusChanged = true;
      }
      if (!existing) {
        const user = await User.findByPk(enrollment.userId, { transaction });
        // The internship is completed on its end date; evaluation may happen later (after reviews finish).
        const evaluatedOn = DateTime.fromJSDate(now, { zone: programPolicy(program).timezone }).toISODate();
        const completionDate = enrollment.endDate < evaluatedOn ? enrollment.endDate : evaluatedOn;
        certificate = await InternshipCertificate.create(
          {
            enrollmentId,
            certificateNumber: generateCertificateNumber(now),
            recipientName: user.name,
            programTitle: program.title,
            track: program.track,
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            completionDate,
            finalScore: results.finalScore,
            issuedAt: now,
            status: 'valid',
          },
          { transaction }
        );
        issued = true;
        await audit({
          actorId,
          action: 'certificate.issued',
          entityType: 'InternshipCertificate',
          entityId: certificate.id,
          metadata: { enrollmentId, certificateNumber: certificate.certificateNumber, finalScore: results.finalScore },
          ip,
          transaction,
        });
        await notify(
          {
            userId: enrollment.userId,
            type: 'certificate_available',
            title: 'Your certificate is ready',
            message: `Congratulations! Your ${program.title} completion certificate has been issued.`,
            resourceType: 'InternshipCertificate',
            resourceId: certificate.id,
            link: '/student/internship/certificate',
            dedupeKey: `certificate-issued:${certificate.id}`,
          },
          { transaction }
        );
      }
      if (statusChanged) {
        await notify(
          {
            userId: enrollment.userId,
            type: 'internship_completed',
            title: 'Internship completed — qualified',
            message: `You completed ${program.title} with a final score of ${results.finalScore}%.`,
            resourceType: 'InternshipEnrollment',
            resourceId: enrollment.id,
            link: '/student/internship/progress',
            dedupeKey: `internship-completed:${enrollment.id}:qualified`,
          },
          { transaction }
        );
      }
    } else if (results.outcome === 'not_qualified') {
      if (existing && existing.status === 'valid') {
        // A valid certificate is never silently removed; revocation is a separate audited admin action.
        return { enrollment, results, certificate: existing, issued: false, warning: 'Results no longer meet the requirements, but a valid certificate exists. Revoke it explicitly if required.' };
      }
      if (enrollment.status !== 'completed_not_qualified' || Number(enrollment.finalScore) !== results.finalScore) {
        const failed = results.checks.filter((c) => !c.passed).map((c) => c.label);
        await enrollment.update(
          {
            status: 'completed_not_qualified',
            finalScore: results.finalScore,
            completionProgress: results.completionProgress,
            completedAt: enrollment.completedAt || now,
            evaluatedAt: now,
            statusReason: `Requirements not met: ${failed.join('; ')}`.slice(0, 500),
          },
          { transaction }
        );
        statusChanged = true;
        await notify(
          {
            userId: enrollment.userId,
            type: 'internship_completed',
            title: 'Internship completed',
            message: `${program.title} has ended. Your final score is ${results.finalScore ?? 0}%, which does not meet the certificate requirements.`,
            resourceType: 'InternshipEnrollment',
            resourceId: enrollment.id,
            link: '/student/internship/certificate',
            dedupeKey: `internship-completed:${enrollment.id}:not-qualified:${results.finalScore}`,
          },
          { transaction }
        );
      }
    } else if (['in_progress', 'awaiting_assessments'].includes(results.outcome)) {
      await enrollment.update({ completionProgress: results.completionProgress, evaluatedAt: now }, { transaction });
    }

    if (statusChanged) {
      await audit({
        actorId,
        action: 'enrollment.evaluated',
        entityType: 'InternshipEnrollment',
        entityId: enrollment.id,
        metadata: { outcome: results.outcome, finalScore: results.finalScore, completionProgress: results.completionProgress },
        ip,
        transaction,
      });
    }
    return { enrollment, results, certificate, issued };
  });

  if (outcome.certificate && !outcome.certificate.pdfStorageKey) {
    await ensureCertificatePdf(outcome.certificate).catch((err) => logger.error({ err }, 'Certificate PDF generation failed'));
  }
  return outcome;
}

/** Generates and stores the PDF if it is missing. Returns a Buffer. */
export async function ensureCertificatePdf(certificate) {
  const storage = getStorage();
  if (storage && certificate.pdfStorageKey?.startsWith('certificates/v3/') && (await storage.exists(certificate.pdfStorageKey))) {
    return storage.getBuffer(certificate.pdfStorageKey);
  }
  const pdf = await renderCertificatePdf(certificate);
  if (storage) {
    const key = generateStorageKey('certificates/v3', 'pdf');
    await storage.put(key, pdf, 'application/pdf');
    const [count] = await InternshipCertificate.update({ pdfStorageKey: key }, { where: { id: certificate.id, pdfStorageKey: certificate.pdfStorageKey ?? null } });
    if (count === 0) await storage.remove(key); // another process stored it first
    else certificate.pdfStorageKey = key;
  }
  return pdf;
}

export async function getCertificatePdfForUser(user, { enrollmentId } = {}) {
  const where = enrollmentId ? { id: enrollmentId } : { userId: user.id };
  const enrollment = await InternshipEnrollment.findOne({ where, order: [['enrolledAt', 'DESC']] });
  if (!enrollment) throw notFound('No internship enrollment found.');
  if (enrollment.userId !== user.id && user.role !== 'admin') throw forbidden('You cannot download this certificate.');
  const certificate = await InternshipCertificate.findOne({ where: { enrollmentId: enrollment.id } });
  if (!certificate) throw notFound('No certificate has been issued for this internship.');
  if (certificate.status !== 'valid') throw forbidden('This certificate has been revoked.');
  const program = await InternshipProgram.findByPk(enrollment.programId, { attributes: ['certificateFee'] });
  await assertCertificatePaymentApproved({ certificateType: 'internship', certificate, userId: user.id, fee: program.certificateFee });
  const pdf = await ensureCertificatePdf(certificate);
  return { certificate, pdf };
}

/** Public verification: only approved, non-sensitive fields. */
export async function verifyCertificate(certificateNumber) {
  const normalized = String(certificateNumber || '').trim().toUpperCase();
  if (/^G360-C-\d{4}-[A-Z0-9]{8}$/.test(normalized)) {
    const cert = await CourseCertificate.findOne({ where: { certificateNumber: normalized } });
    if (!cert) return { valid: false, status: 'not_found', certificateNumber: normalized };
    const enrollment = await CourseEnrollment.findByPk(cert.enrollmentId);
    const course = enrollment ? await Course.findByPk(enrollment.courseId, { attributes: ['certificateFee'] }) : null;
    if (Number(course?.certificateFee || 0) > 0) {
      const payment = await CertificatePaymentRequest.findOne({ where: { courseCertificateId: cert.id, status: 'approved' }, attributes: ['id'] });
      if (!payment) return { valid: false, status: 'not_found', certificateNumber: normalized };
    }
    return {
      valid: true,
      status: 'valid',
      certificateNumber: cert.certificateNumber,
      holderName: cert.recipientName,
      certificateType: 'course',
      courseTitle: cert.courseTitle,
      completionDate: cert.completionDate,
      issuedAt: cert.issuedAt,
    };
  }
  if (!/^G360-\d{4}-[A-Z0-9]{8}$/.test(normalized)) return { valid: false, status: 'not_found', certificateNumber: normalized };
  const cert = await InternshipCertificate.findOne({ where: { certificateNumber: normalized } });
  if (!cert) return { valid: false, status: 'not_found', certificateNumber: normalized };
  const enrollment = await InternshipEnrollment.findByPk(cert.enrollmentId);
  const program = enrollment ? await InternshipProgram.findByPk(enrollment.programId, { attributes: ['certificateFee'] }) : null;
  if (Number(program?.certificateFee || 0) > 0) {
    const payment = await CertificatePaymentRequest.findOne({ where: { internshipCertificateId: cert.id, status: 'approved' }, attributes: ['id'] });
    if (!payment) return { valid: false, status: 'not_found', certificateNumber: normalized };
  }
  return {
    valid: cert.status === 'valid',
    status: cert.status,
    certificateNumber: cert.certificateNumber,
    holderName: cert.recipientName,
    certificateType: 'internship',
    programTitle: cert.programTitle,
    track: cert.track,
    startDate: cert.startDate,
    endDate: cert.endDate,
    completionDate: cert.completionDate,
    issuedAt: cert.issuedAt,
    ...(cert.status === 'revoked' ? { revokedAt: cert.revokedAt } : {}),
  };
}

export async function revokeCertificate(admin, certificateId, reason, { ip } = {}) {
  if (!reason || reason.trim().length < 5) throw badRequest('A revocation reason is required.');
  return sequelize.transaction(async (transaction) => {
    const cert = await InternshipCertificate.findByPk(certificateId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!cert) throw notFound('Certificate not found.');
    if (cert.status === 'revoked') throw conflict('This certificate is already revoked.');
    await cert.update({ status: 'revoked', revokedAt: new Date(), revokedBy: admin.id, revocationReason: reason.trim() }, { transaction });
    const enrollment = await InternshipEnrollment.findByPk(cert.enrollmentId, { transaction });
    await audit({ actorId: admin.id, action: 'certificate.revoked', entityType: 'InternshipCertificate', entityId: cert.id, metadata: { certificateNumber: cert.certificateNumber, reason: reason.trim() }, ip, transaction });
    await notify(
      {
        userId: enrollment.userId,
        type: 'certificate_revoked',
        title: 'Certificate revoked',
        message: `Your certificate ${cert.certificateNumber} has been revoked. Contact Global360 support for details.`,
        resourceType: 'InternshipCertificate',
        resourceId: cert.id,
        link: '/student/internship/certificate',
        dedupeKey: `certificate-revoked:${cert.id}`,
      },
      { transaction }
    );
    return cert;
  });
}

/** Ended programs: evaluate every active enrollment (used by the scheduled job and admins). */
export async function evaluateEndedEnrollments({ programId, now = new Date() } = {}) {
  const where = { status: { [Op.in]: ['approved', 'in_progress', 'completed_not_qualified'] } };
  if (programId) where.programId = programId;
  const enrollments = await InternshipEnrollment.findAll({
    where,
    include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'endDate', 'timezone'], where: { endDate: { [Op.lte]: DateTime.fromJSDate(now).plus({ days: 1 }).toISODate() } } }],
  });
  const summary = { evaluated: 0, qualified: 0, notQualified: 0, awaiting: 0, notEnded: 0 };
  for (const e of enrollments) {
    const { results } = await evaluateEnrollment(e.id, { now });
    summary.evaluated += 1;
    if (results.outcome === 'qualified') summary.qualified += 1;
    else if (results.outcome === 'not_qualified') summary.notQualified += 1;
    else if (results.outcome === 'awaiting_assessments') summary.awaiting += 1;
    else summary.notEnded += 1;
  }
  return summary;
}
