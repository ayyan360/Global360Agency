export function certificateFilename(completionType, completionTitle) {
  const safeTitle = String(completionTitle || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  const type = completionType === 'Course' ? 'Course Completion' : 'Internship Completion';
  return `${type} - ${safeTitle || 'Certificate'} - Global360.pdf`;
}
