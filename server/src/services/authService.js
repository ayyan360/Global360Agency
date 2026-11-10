import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { User, Session } from '../models/index.js';
import { conflict, unauthorized, badRequest, forbidden } from '../utils/errors.js';
import { permissionsFor } from '../utils/permissions.js';

// Lower cost only in the automated test environment to keep the suite fast.
const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
// A real bcrypt hash used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('global360-timing-equalizer', BCRYPT_ROUNDS);

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    headline: user.headline,
    bio: user.bio,
    preferences: user.preferences || {},
    createdAt: user.createdAt,
    permissions: permissionsFor(user.role),
  };
}

/** Public registration always creates a student. Roles are never taken from the request. */
export async function registerUser({ name, email, password }) {
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalized }, attributes: ['id'] });
  if (existing) throw conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN' });
  const passwordHash = await hashPassword(password);
  return User.create({ name: name.trim(), email: normalized, passwordHash, role: 'student', passwordChangedAt: new Date() });
}

export async function verifyCredentials(email, password) {
  const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password.');
  if (user.accountStatus !== 'active') throw forbidden('This account is not active. Please contact support.');
  return user;
}

export async function createSession(user, { userAgent, ip } = {}) {
  const ttlMs = env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000;
  const session = await Session.create({
    userId: user.id,
    expiresAt: new Date(Date.now() + ttlMs),
    userAgent: userAgent?.slice(0, 300),
    ip,
  });
  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    jwtid: session.id,
    expiresIn: Math.floor(ttlMs / 1000),
  });
  await user.update({ lastLoginAt: new Date() });
  return { token, ttlMs };
}

export async function revokeSession(sessionId) {
  if (!sessionId) return;
  await Session.update({ revokedAt: new Date() }, { where: { id: sessionId, revokedAt: null } });
}

export async function revokeAllSessions(userId, { exceptSessionId } = {}) {
  const where = { userId, revokedAt: null };
  if (exceptSessionId) where.id = { [Op.ne]: exceptSessionId };
  await Session.update({ revokedAt: new Date() }, { where });
}

export async function changePassword(user, { currentPassword, newPassword }, currentSessionId) {
  const fresh = await User.findByPk(user.id);
  const ok = await bcrypt.compare(currentPassword, fresh.passwordHash);
  if (!ok) throw badRequest('Your current password is incorrect.', { code: 'WRONG_PASSWORD' });
  if (currentPassword === newPassword) throw badRequest('The new password must be different from the current one.');
  await fresh.update({ passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() });
  // Sign out every other device after a password change.
  await revokeAllSessions(fresh.id, { exceptSessionId: currentSessionId });
}

export async function purgeExpiredSessions() {
  return Session.destroy({ where: { expiresAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } });
}
