import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Session, User } from '../models/index.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import { can } from '../utils/permissions.js';

export const SESSION_COOKIE = 'g360_session';

export function sessionCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

/**
 * Resolves the current user from the HTTP-only session cookie.
 * The JWT carries the session id (jti); the session row must exist, be unexpired and not revoked,
 * which gives us server-side logout/revocation. The user must be active.
 */
export async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const session = await Session.findByPk(payload.jti);
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) return next();
    const user = await User.findByPk(payload.sub);
    if (!user || user.accountStatus !== 'active') return next();
    req.user = user;
    req.sessionId = session.id;
  } catch {
    // invalid/expired token: treat as anonymous
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!permissions.some((p) => can(req.user, p))) return next(forbidden());
    next();
  };
}
