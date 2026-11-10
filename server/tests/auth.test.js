import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, resetDatabase, createUser, agentFor, closeDb, PASSWORD } from './helpers.js';
import { User, Session } from '../src/models/index.js';

describe('Authentication', () => {
  before(resetDatabase);
  after(closeDb);

  it('registers a student, sets an HTTP-only session cookie and never returns the password hash', async () => {
    const a = await agentFor();
    const res = await a.post('/api/auth/register').send({ name: 'New Learner', email: 'New.Learner@Example.com', password: 'Secret123' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'student');
    assert.equal(res.body.data.user.email, 'new.learner@example.com');
    assert.equal(res.body.data.user.passwordHash, undefined);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('g360_session='));
    assert.ok(cookie, 'session cookie set');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const stored = await User.findOne({ where: { email: 'new.learner@example.com' } });
    assert.notEqual(stored.passwordHash, 'Secret123');
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
  });

  it('ignores a role supplied during public registration', async () => {
    const a = await agentFor();
    const res = await a.post('/api/auth/register').send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'Secret123', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'student');
  });

  it('rejects duplicate emails', async () => {
    const a = await agentFor();
    await a.post('/api/auth/register').send({ name: 'Dup One', email: 'dup@example.com', password: 'Secret123' });
    const res = await a.post('/api/auth/register').send({ name: 'Dup Two', email: 'DUP@example.com', password: 'Secret123' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  it('validates registration input', async () => {
    const a = await agentFor();
    const res = await a.post('/api/auth/register').send({ name: 'X', email: 'not-an-email', password: 'short' });
    assert.equal(res.status, 422);
    const fields = res.body.error.details.map((d) => d.field);
    assert.ok(fields.includes('name') && fields.includes('email') && fields.includes('password'));
  });

  it('logs in with correct credentials and rejects an incorrect password', async () => {
    const user = await createUser('student');
    const a = await agentFor();
    const bad = await a.post('/api/auth/login').send({ email: user.email, password: 'WrongPass1' });
    assert.equal(bad.status, 401);
    const good = await a.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    assert.equal(good.status, 200);
    const me = await a.get('/api/auth/me');
    assert.equal(me.body.data.user.id, user.id);
  });

  it('rejects state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'CSRF_INVALID');
  });

  it('logout revokes the server-side session so the old cookie no longer works', async () => {
    const user = await createUser('student');
    const a = await agentFor(user);
    const res = await a.post('/api/auth/logout');
    assert.equal(res.status, 204);
    const me = await a.get('/api/auth/me');
    assert.equal(me.body.data.user, null);
    const sessions = await Session.findAll({ where: { userId: user.id } });
    assert.ok(sessions.every((s) => s.revokedAt));
    const replay = await request(app).get('/api/student/dashboard').set('Cookie', a.sessionCookie);
    assert.equal(replay.status, 401, 'a stolen copy of the old cookie is rejected');
  });

  it('blocks protected routes for anonymous users and suspended accounts', async () => {
    const anon = await request(app).get('/api/student/dashboard');
    assert.equal(anon.status, 401);
    const user = await createUser('student');
    const a = await agentFor(user);
    await user.update({ accountStatus: 'suspended' });
    const res = await a.get('/api/student/dashboard');
    assert.equal(res.status, 401);
  });

  it('enforces role authorization on admin routes', async () => {
    const student = await createUser('student');
    const admin = await createUser('admin');
    const s = await agentFor(student);
    const a = await agentFor(admin);
    assert.equal((await s.get('/api/admin/dashboard')).status, 403);
    assert.equal((await a.get('/api/admin/dashboard')).status, 200);
  });

  it('changes password, requires the current password and signs out other sessions', async () => {
    const user = await createUser('student');
    const first = await agentFor(user);
    const second = await agentFor(user);
    const wrong = await first.post('/api/auth/change-password').send({ currentPassword: 'nope', newPassword: 'NewSecret99' });
    assert.equal(wrong.status, 400);
    const ok = await first.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NewSecret99' });
    assert.equal(ok.status, 200);
    assert.equal((await first.get('/api/student/dashboard')).status, 200, 'current session stays valid');
    assert.equal((await second.get('/api/student/dashboard')).status, 401, 'other sessions revoked');
  });

  it('does not let a student change their own role through the profile endpoint', async () => {
    const user = await createUser('student');
    const a = await agentFor(user);
    const res = await a.patch('/api/auth/profile').send({ name: 'Renamed', role: 'admin' });
    assert.equal(res.status, 200);
    await user.reload();
    assert.equal(user.role, 'student');
    assert.equal(user.name, 'Renamed');
  });
});
