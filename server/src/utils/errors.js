export class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
    this.details = details;
    this.expose = true;
  }
}

function defaultCode(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
      503: 'SERVICE_UNAVAILABLE',
    }[status] || 'ERROR'
  );
}

export const badRequest = (msg, opts) => new AppError(400, msg, opts);
export const unauthorized = (msg = 'Please log in to continue.') => new AppError(401, msg);
export const forbidden = (msg = 'You do not have permission to perform this action.') => new AppError(403, msg);
export const notFound = (msg = 'Resource not found.') => new AppError(404, msg);
export const conflict = (msg, opts) => new AppError(409, msg, opts);
export const unprocessable = (msg, details) => new AppError(422, msg, { details });
export const unavailable = (msg) => new AppError(503, msg);
