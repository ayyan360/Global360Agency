import { env } from '../../config/env.js';
import { renderCertificatePdf as renderDesignedCertificatePdf } from '../certificateDesignPdf.js';

export async function renderCertificatePdf(certificate) {
  const verifyUrl = `${env.appUrl.replace(/\/$/, '')}/verify-certificate/${encodeURIComponent(certificate.certificateNumber)}`;
  return renderDesignedCertificatePdf({
    recipientName: certificate.recipientName,
    title: 'Internship Completion Certificate',
    description: `has successfully completed the ${certificate.programTitle} internship in the ${certificate.track} track, from ${formatDate(certificate.startDate)} to ${formatDate(certificate.endDate)}.`,
    completionDate: certificate.completionDate,
    certificateNumber: certificate.certificateNumber,
    verificationUrl: verifyUrl,
  });
}

function formatDate(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
