import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, resetDatabase, createUser, agentFor, createCourse, closeDb } from './helpers.js';
import { LessonProgress, CourseEnrollment, CourseCertificate } from '../src/models/index.js';

describe('Courses and learning', () => {
  let web;
  let draft;
  before(async () => {
    await resetDatabase();
    web = await createCourse({ title: 'Searchable Web Basics', lessons: 3, preview: 1 });
    await createCourse({ title: 'Python Things', lessons: 2 });
    draft = await createCourse({ title: 'Secret Draft Course', status: 'draft' });
  });
  after(closeDb);

  it('lists only published courses with database-derived lesson counts', async () => {
    const res = await request(app).get('/api/courses');
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.total, 2);
    const item = res.body.data.find((c) => c.id === web.course.id);
    assert.equal(item.lessonCount, 3);
    assert.equal(item.rating, null, 'no invented rating without reviews');
    assert.ok(!res.body.data.some((c) => c.title === 'Secret Draft Course'));
  });

  it('supports search, filtering and sorting', async () => {
    const res = await request(app).get('/api/courses').query({ search: 'searchable', level: 'beginner', sort: 'title' });
    assert.equal(res.body.meta.total, 1);
    assert.equal(res.body.data[0].id, web.course.id);
    const none = await request(app).get('/api/courses').query({ level: 'advanced' });
    assert.equal(none.body.meta.total, 0);
    const bad = await request(app).get('/api/courses').query({ sort: 'drop table' });
    assert.equal(bad.status, 422);
  });

  it('returns course details with curriculum but hides drafts from the public', async () => {
    const res = await request(app).get(`/api/courses/${web.course.slug}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.modules[0].lessons.length, 3);
    assert.equal(res.body.data.modules[0].lessons[0].videoUrl, undefined, 'video URLs are not exposed in the outline');
    assert.equal((await request(app).get(`/api/courses/${draft.course.slug}`)).status, 404);
  });

  it('enrolls a student once and rejects duplicate enrollment', async () => {
    const student = await createUser('student');
    const a = await agentFor(student);
    const first = await a.post(`/api/courses/${web.course.id}/enroll`);
    assert.equal(first.status, 201);
    const second = await a.post(`/api/courses/${web.course.id}/enroll`);
    assert.equal(second.status, 409);
    assert.equal(await CourseEnrollment.count({ where: { userId: student.id, courseId: web.course.id } }), 1);
    assert.equal((await a.post(`/api/courses/${draft.course.id}/enroll`)).status, 404, 'cannot enroll in drafts');
  });

  it('enforces lesson access: previews are public, other lessons need enrollment', async () => {
    const [preview, locked] = web.lessons;
    assert.equal((await request(app).get(`/api/lessons/${preview.id}`)).status, 200);
    assert.equal((await request(app).get(`/api/lessons/${locked.id}`)).status, 401);
    const outsider = await agentFor(await createUser('student'));
    assert.equal((await outsider.get(`/api/lessons/${locked.id}`)).status, 403);
    const learner = await createUser('student');
    const a = await agentFor(learner);
    await a.post(`/api/courses/${web.course.id}/enroll`);
    const ok = await a.get(`/api/lessons/${locked.id}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.navigation.previousLessonId, preview.id);
  });

  it('issues a certificate only after a locked course is fully completed', async () => {
    const learner = await createUser('student');
    const a = await agentFor(learner);
    await a.post(`/api/courses/${web.course.id}/enroll`);
    for (const l of web.lessons) {
      const r1 = await a.post(`/api/lessons/${l.id}/complete`).send({ completed: true });
      assert.equal(r1.status, 200);
      await a.post(`/api/lessons/${l.id}/complete`).send({ completed: true }); // repeat is idempotent
    }
    assert.equal(await LessonProgress.count({ where: { userId: learner.id } }), 3);
    const enrollment = await CourseEnrollment.findOne({ where: { userId: learner.id, courseId: web.course.id } });
    assert.equal(enrollment.status, 'completed');
    assert.equal(await CourseCertificate.count({ where: { enrollmentId: enrollment.id } }), 0, 'unlocked courses do not issue certificates');
    assert.equal((await a.get(`/api/student/courses/${web.course.id}/certificate/download`)).status, 403);

    const admin = await agentFor(await createUser('admin'));
    const locked = await admin.post(`/api/admin/courses/${web.course.id}/lock-curriculum`);
    assert.equal(locked.status, 200);
    assert.equal(locked.body.data.certificatesIssued, 1);
    assert.equal(await CourseCertificate.count({ where: { enrollmentId: enrollment.id } }), 1);
    const download = await a.get(`/api/student/courses/${web.course.id}/certificate/download`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(download.status, 200);
    assert.equal(download.headers['content-type'], 'application/pdf');
    assert.equal(download.body.subarray(0, 4).toString(), '%PDF');
    const outsider = await agentFor(await createUser('student'));
    assert.equal((await outsider.get(`/api/student/courses/${web.course.id}/certificate/download`)).status, 404);
    const dash = await a.get('/api/student/dashboard');
    assert.equal(dash.body.data.stats.completedLessons, 3);
    assert.equal(dash.body.data.stats.overallProgress, 100);
  });

  it('does not issue or allow downloading a certificate for a locked course below 100%', async () => {
    const { course, lessons } = await createCourse({ lessons: 3 });
    const learner = await createUser('student');
    const learnerAgent = await agentFor(learner);
    await learnerAgent.post(`/api/courses/${course.id}/enroll`);
    for (const lesson of lessons.slice(0, 2)) {
      assert.equal((await learnerAgent.post(`/api/lessons/${lesson.id}/complete`).send({ completed: true })).status, 200);
    }

    const enrollment = await CourseEnrollment.findOne({ where: { userId: learner.id, courseId: course.id } });
    await enrollment.update({ status: 'completed', completedAt: new Date() });
    const admin = await agentFor(await createUser('admin'));
    const locked = await admin.post(`/api/admin/courses/${course.id}/lock-curriculum`);
    assert.equal(locked.status, 200);
    assert.equal(locked.body.data.certificatesIssued, 0);
    assert.equal(await CourseCertificate.count({ where: { enrollmentId: enrollment.id } }), 0);
    assert.equal((await learnerAgent.get(`/api/student/courses/${course.id}/certificate/download`)).status, 403);
  });

  it('lets course managers complete an enrollment and issue a certificate', async () => {
    const learner = await createUser('student');
    const learnerAgent = await agentFor(learner);
    await learnerAgent.post(`/api/courses/${web.course.id}/enroll`);
    const admin = await agentFor(await createUser('admin'));

    const completed = await admin.post(`/api/admin/courses/${web.course.id}/enrollments/${(await CourseEnrollment.findOne({ where: { userId: learner.id, courseId: web.course.id } })).id}/complete`);
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.enrollment.status, 'completed');
    assert.ok(completed.body.data.certificate.certificateNumber);
    assert.equal(await LessonProgress.count({ where: { userId: learner.id, courseId: web.course.id, isCompleted: true } }), 3);

    const cannotReopen = await learnerAgent.post(`/api/lessons/${web.lessons[0].id}/complete`).send({ completed: false });
    assert.equal(cannotReopen.status, 409);

    const download = await learnerAgent.get(`/api/student/courses/${web.course.id}/certificate/download`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(download.status, 200);
    assert.equal(download.body.subarray(0, 4).toString(), '%PDF');
  });

  it('rejects completion tracking for students who are not enrolled', async () => {
    const outsider = await agentFor(await createUser('student'));
    const res = await outsider.post(`/api/lessons/${web.lessons[0].id}/complete`).send({ completed: true });
    assert.equal(res.status, 403);
  });

  it('stores contact messages and only admins can read them', async () => {
    const a = await agentFor();
    const res = await a.post('/api/contact').send({ name: 'Visitor', email: 'visitor@example.com', subject: 'Question', message: 'Hello, I have a question about courses.' });
    assert.equal(res.status, 201);
    const invalid = await a.post('/api/contact').send({ name: 'V', email: 'bad', subject: '', message: 'short' });
    assert.equal(invalid.status, 422);
    const student = await agentFor(await createUser('student'));
    assert.equal((await student.get('/api/admin/messages')).status, 403);
    const admin = await agentFor(await createUser('admin'));
    const list = await admin.get('/api/admin/messages');
    assert.equal(list.status, 200);
    assert.equal(list.body.data[0].subject, 'Question');
  });

  it('lets admins create courses with modules and lessons, and blocks instructors from others\' courses', async () => {
    const admin = await agentFor(await createUser('admin'));
    const created = await admin.post('/api/admin/courses').send({
      title: 'Admin Created Course',
      shortDescription: 'Created through the admin API.',
      description: 'A full description that is longer than twenty characters.',
      category: 'Testing',
      level: 'beginner',
      status: 'published',
    });
    assert.equal(created.status, 201);
    const mod = await admin.post(`/api/admin/courses/${created.body.data.id}/modules`).send({ title: 'Intro' });
    assert.equal(mod.status, 201);
    const lesson = await admin.post(`/api/admin/modules/${mod.body.data.id}/lessons`).send({ title: 'Welcome', videoUrl: 'javascript:alert(1)' });
    assert.equal(lesson.status, 422, 'non-http video URLs are rejected');
    const lesson2 = await admin.post(`/api/admin/modules/${mod.body.data.id}/lessons`).send({ title: 'Welcome', videoUrl: 'https://www.youtube.com/watch?v=abc' });
    assert.equal(lesson2.status, 201);
    // PATCH must not reset omitted fields
    await admin.patch(`/api/admin/courses/${created.body.data.id}`).send({ outcomes: ['One', 'Two'] });
    await admin.patch(`/api/admin/courses/${created.body.data.id}`).send({ title: 'Renamed Admin Course' });
    const detail = await admin.get(`/api/admin/courses/${created.body.data.id}`);
    assert.deepEqual(detail.body.data.outcomes, ['One', 'Two']);

    const instructor = await agentFor(await createUser('instructor'));
    assert.equal((await instructor.patch(`/api/admin/courses/${created.body.data.id}`).send({ title: 'Hijack attempt' })).status, 404);
  });
});
