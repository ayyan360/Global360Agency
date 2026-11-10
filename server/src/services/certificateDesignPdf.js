import PDFDocument from 'pdfkit';
import { DateTime } from 'luxon';
import { fileURLToPath } from 'node:url';

const DESIGN_PATH = fileURLToPath(new URL('../../../client/public/Elegant Global360 Completion Certificate (1).png', import.meta.url));
const VIOLET = '#4B0BC4';
const NAVY = '#111640';

function formatDate(value) {
  const date = value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromISO(String(value));
  return date.toFormat('d LLLL yyyy');
}

function renderCertificatePdf({ recipientName, title, description, completionDate, certificateNumber, verificationUrl }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: { Title: title, Author: 'Global360', Subject: `Certificate ${certificateNumber}` },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const { width, height } = doc.page;
  const imageWidth = width;
  const imageHeight = imageWidth * (1333 / 2000);
  const imageY = (height - imageHeight) / 2;
  const x = (fraction) => fraction * imageWidth;
  const y = (fraction) => imageY + fraction * imageHeight;

  doc.image(DESIGN_PATH, 0, imageY, { width: imageWidth, height: imageHeight });

  const nameFontSize = Math.min(38, Math.max(23, 38 * (34 / Math.max(recipientName.length, 34))));
  doc.font('Times-Italic').fontSize(nameFontSize).fillColor(VIOLET).text(recipientName, x(0.12), y(0.445), {
    width: x(0.76),
    height: imageHeight * 0.07,
    align: 'center',
    ellipsis: true,
  });
  doc.font('Times-Italic').fontSize(14).fillColor(NAVY).text(description, x(0.18), y(0.545), {
    width: x(0.64),
    height: imageHeight * 0.07,
    align: 'center',
    lineGap: 3,
    ellipsis: true,
  });
  doc.font('Times-Bold').fontSize(15).fillColor(NAVY).text(formatDate(completionDate), x(0.13), y(0.788), {
    width: x(0.24),
    height: imageHeight * 0.025,
    align: 'center',
    ellipsis: true,
  });

  const idText = verificationUrl ? `${certificateNumber}  |  ${verificationUrl}` : certificateNumber;
  doc.font('Helvetica').fontSize(6).fillColor(NAVY).text(idText, 70, height - 9, {
    width: width - 140,
    align: 'center',
    link: verificationUrl,
    ellipsis: true,
  });

  doc.end();
  return done;
}

export { renderCertificatePdf };
