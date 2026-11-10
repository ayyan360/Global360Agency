import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const CSRF_COOKIE = 'g360_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function cookieOptions() {
  return {
    httpOnly: false, // readable by the SPA so it can echo it in the X-CSRF-Token header
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, cookieOptions());
  return token;
}

/**
 * Double-submit CSRF protection for the cookie-based session.
 * Every state-changing request must send an X-CSRF-Token header equal to the g360_csrf cookie.
 * A cross-site attacker can make the browser send cookies but cannot read the cookie to forge the header.
 */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next(new AppError(403, 'Security token missing or invalid. Please refresh the page and try again.', { code: 'CSRF_INVALID' }));
  }
  next();
}
