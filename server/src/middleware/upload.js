import multer from 'multer';
import { HARD_MAX_FILE_BYTES, HARD_MAX_FILES } from '../services/internship/submissionService.js';

/**
 * Multipart parsing into memory with hard limits. Files are never written to a public path
 * or executed; detailed type/size validation against program policy happens in the service.
 */
export const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: HARD_MAX_FILE_BYTES,
    files: HARD_MAX_FILES,
    fields: 10,
    fieldSize: 100 * 1024,
    parts: HARD_MAX_FILES + 10,
  },
}).array('files', HARD_MAX_FILES);
