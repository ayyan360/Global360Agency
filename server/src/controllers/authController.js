import { ok, created, noContent, clientIp } from '../utils/http.js';
import * as auth from '../services/authService.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../middleware/auth.js';
import { issueCsrfToken, CSRF_COOKIE } from '../middleware/csrf.js';
import { User } from '../models/index.js';
import { notify } from '../services/notificationService.js';

async function startSession(req, res, user) {
  const { token, ttlMs } = await auth.createSession(user, { userAgent: req.get('user-agent'), ip: clientIp(req) });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(ttlMs));
  // Rotate the CSRF token on login to prevent session-fixation style CSRF reuse.
  const csrfToken = issueCsrfToken(res);
  return csrfToken;
}

export async function csrf(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE];
  const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : issueCsrfToken(res);
  ok(res, { csrfToken: token });
}

export async function register(req, res) {
  const user = await auth.registerUser(req.valid.body);
  const csrfToken = await startSession(req, res, user);
  await notify({ userId: user.id, type: 'welcome', title: 'Welcome to Global360', message: 'Your account is ready. Explore courses or apply for a free internship.', link: '/courses' });
  created(res, { user: auth.serializeUser(user), csrfToken });
}

export async function login(req, res) {
  const user = await auth.verifyCredentials(req.valid.body.email, req.valid.body.password);
  const csrfToken = await startSession(req, res, user);
  ok(res, { user: auth.serializeUser(user), csrfToken });
}

export async function logout(req, res) {
  await auth.revokeSession(req.sessionId);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  noContent(res);
}

export async function me(req, res) {
  ok(res, { user: auth.serializeUser(req.user) });
}

export async function changePassword(req, res) {
  await auth.changePassword(req.user, req.valid.body, req.sessionId);
  ok(res, { message: 'Password updated. Other devices have been signed out.' });
}

export async function updateProfile(req, res) {
  const user = await User.findByPk(req.user.id);
  const { preferences, ...rest } = req.valid.body;
  const updates = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (preferences) updates.preferences = { ...(user.preferences || {}), ...preferences };
  await user.update(updates);
  ok(res, { user: auth.serializeUser(user) });
}
