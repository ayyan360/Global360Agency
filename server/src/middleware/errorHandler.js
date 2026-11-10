import multer from 'multer';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError, DatabaseError } from 'sequelize';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` } });
}

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) };
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    body = {
      code: err.code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'UPLOAD_ERROR',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'A file exceeds the maximum upload size.' : 'The upload could not be processed.',
    };
  } else if (err instanceof UniqueConstraintError) {
    status = 409;
    body = { code: 'CONFLICT', message: 'This record already exists.' };
  } else if (err instanceof ForeignKeyConstraintError) {
    status = 409;
    body = { code: 'CONFLICT', message: 'This record is referenced by other data and cannot be changed this way.' };
  } else if (err instanceof ValidationError) {
    status = 422;
    body = {
      code: 'VALIDATION_ERROR',
      message: 'Please correct the highlighted fields.',
      details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'BAD_REQUEST', message: 'Malformed JSON body.' };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' };
  } else if (err instanceof DatabaseError && /invalid input syntax for type uuid/.test(err.message)) {
    status = 404;
    body = { code: 'NOT_FOUND', message: 'Resource not found.' };
  }

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }
  res.status(status).json({ error: body });
}
