import { ok, created } from '../utils/http.js';
import * as courses from '../services/courseService.js';
import * as programs from '../services/internship/programService.js';
import { verifyCertificate } from '../services/internship/certificateService.js';
import { getPublicSettings } from '../services/settingsService.js';
import { ContactMessage, User } from '../models/index.js';
import { notify } from '../services/notificationService.js';
import { sequelize } from '../models/index.js';
import { isStorageConfigured } from '../services/storage/index.js';

export async function health(_req, res) {
  let database = 'ok';
  try {
    await sequelize.authenticate();
  } catch {
    database = 'unavailable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    data: { status: database === 'ok' ? 'ok' : 'degraded', database, storage: isStorageConfigured() ? 'configured' : 'not_configured', time: new Date().toISOString() },
  });
}

export async function listCourses(req, res) {
  const { items, meta } = await courses.listCourses(req.valid.query);
  ok(res, items, meta);
}

export async function categories(_req, res) {
  ok(res, await courses.listCategories());
}

export async function getCourse(req, res) {
  ok(res, await courses.getCourseDetail(req.params.slug, req.user));
}

export async function home(_req, res) {
  const [featured, stats, internshipPrograms, settings] = await Promise.all([
    courses.listFeatured(4),
    courses.publicStats(),
    programs.listPublicPrograms(),
    getPublicSettings(),
  ]);
  ok(res, { featured, stats, internshipPrograms: internshipPrograms.slice(0, 3), settings });
}

export async function stats(_req, res) {
  ok(res, await courses.publicStats());
}

export async function settings(_req, res) {
  ok(res, await getPublicSettings());
}

export async function contact(req, res) {
  const { website, ...data } = req.valid.body;
  if (website) return created(res, { received: true }); // honeypot tripped: silently accept
  const message = await ContactMessage.create(data);
  const admins = await User.findAll({ where: { role: 'admin', accountStatus: 'active' }, attributes: ['id'] });
  for (const a of admins) {
    await notify({ userId: a.id, type: 'contact_message', title: 'New contact message', message: `${data.name}: ${data.subject}`, resourceType: 'ContactMessage', resourceId: message.id, link: '/admin/messages' });
  }
  created(res, { received: true, id: message.id });
}

export async function listInternships(_req, res) {
  ok(res, await programs.listPublicPrograms());
}

export async function tracks(_req, res) {
  ok(res, await programs.listTracks());
}

export async function getInternship(req, res) {
  ok(res, await programs.getPublicProgram(req.params.slug, req.user));
}

export async function verify(req, res) {
  ok(res, await verifyCertificate(req.params.certificateNumber));
}
