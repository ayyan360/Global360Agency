import crypto from 'node:crypto';
import { Op } from 'sequelize';
import {
  sequelize,
  User,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  LessonProgress,
  InternshipProgram,
  InternshipHoliday,
  InternshipTask,
  InternshipApplication,
  InternshipEnrollment,
  InternshipReviewerAssignment,
  TaskSubmission,
  TaskAssessment,
  TaskReviewHistory,
} from '../models/index.js';
import { hashPassword } from '../services/authService.js';
import { slugify } from '../utils/slug.js';
import { generateTasksFromPlan } from '../services/internship/taskService.js';
import { evaluateEnrollment } from '../services/internship/certificateService.js';
import { SAMPLE_COURSES } from './data/courses.js';
import { programDates, samplePrograms, taskPlanForTrack } from './data/programs.js';

const randomPassword = () => crypto.randomBytes(24).toString('base64url');

async function ensureUser({ email, name, role, password, headline, bio }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) return { user: existing, created: false };
  const user = await User.create({
    email,
    name,
    role,
    headline,
    bio,
    passwordHash: await hashPassword(password || randomPassword()),
    passwordChangedAt: new Date(),
  });
  return { user, created: true };
}

/** Sample instructors are content owners only; they get random, unpublished passwords. */
async function seedInstructors() {
  const defs = {
    web: { email: 'sample.instructor.web@example.com', name: 'Sample Instructor — Web', headline: 'Sample instructor profile (development data)' },
    data: { email: 'sample.instructor.data@example.com', name: 'Sample Instructor — Data', headline: 'Sample instructor profile (development data)' },
    design: { email: 'sample.instructor.design@example.com', name: 'Sample Instructor — Design', headline: 'Sample instructor profile (development data)' },
  };
  const out = {};
  for (const [key, d] of Object.entries(defs)) {
    out[key] = (await ensureUser({ ...d, role: 'instructor', bio: 'This is placeholder instructor information included with the Global360 sample content.' })).user;
  }
  return out;
}

export async function seedCourses(log = console.log) {
  const instructors = await seedInstructors();
  let created = 0;
  for (const [i, def] of SAMPLE_COURSES.entries()) {
    const slug = slugify(def.title);
    if (await Course.findOne({ where: { slug } })) continue;
    await sequelize.transaction(async (transaction) => {
      const course = await Course.create(
        {
          title: def.title,
          slug,
          shortDescription: def.shortDescription,
          description: def.description,
          category: def.category,
          level: def.level,
          status: 'published',
          instructorId: instructors[def.instructorKey]?.id || null,
          outcomes: def.outcomes,
          requirements: def.requirements,
          isFree: true,
          isSample: true,
          publishedAt: new Date(Date.now() - (SAMPLE_COURSES.length - i) * 86400000),
        },
        { transaction }
      );
      for (const [mi, m] of def.modules.entries()) {
        const mod = await CourseModule.create({ courseId: course.id, title: m.title, position: mi }, { transaction });
        for (const [li, l] of m.lessons.entries()) {
          await Lesson.create({ moduleId: mod.id, position: li, isPreview: false, ...l }, { transaction });
        }
      }
    });
    created += 1;
  }
  log(`Courses: ${created} created, ${SAMPLE_COURSES.length - created} already present.`);
}

export async function seedPrograms(log = console.log) {
  const dates = programDates();
  const programs = {};
  for (const def of samplePrograms(dates)) {
    const { key, holidays, ...data } = def;
    let program = await InternshipProgram.findOne({ where: { slug: data.slug } });
    if (!program) {
      program = await InternshipProgram.create(data);
      log(`Program created: ${program.title} (${program.startDate} → ${program.endDate})`);
    }
    for (const h of holidays) {
      await InternshipHoliday.findOrCreate({ where: { programId: program.id, date: h.date }, defaults: { programId: program.id, ...h } });
    }
    if ((await InternshipTask.count({ where: { programId: program.id } })) === 0) {
      const { created, skipped } = await generateTasksFromPlan(null, program.id, taskPlanForTrack(program.track), { publish: true });
      log(`  ${created.length} tasks scheduled${skipped.length ? `, ${skipped.length} skipped (non-working days)` : ''}.`);
    }
    programs[key] = program;
  }
  return programs;
}

// ---------------- Optional demo data ----------------

const DEMO_FEEDBACK = [
  'Clear, well-organized work. Your explanation shows good understanding of the concepts.',
  'Good result. Consider adding comments to explain the trickier parts.',
  'Solid submission that meets the acceptance criteria. Nice attention to detail.',
  'Works as required. Next time, test edge cases more thoroughly.',
];

async function addAssessedSubmission({ task, enrollment, reviewer, marksRatio, decision = 'approve', submittedAt, transaction }) {
  const submission = await TaskSubmission.create(
    {
      taskId: task.id,
      enrollmentId: enrollment.id,
      version: 1,
      submissionText: `Sample submission for "${task.title}". Approach, key decisions and links are described here.`,
      repositoryUrl: task.submissionTypes.includes('repository') ? 'https://github.com/example/sample-internship-work' : null,
      status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'submitted',
      submittedAt,
      isLate: submittedAt > task.dueAt,
    },
    { transaction }
  );
  await TaskReviewHistory.create({ submissionId: submission.id, reviewerId: enrollment.userId, newStatus: 'submitted', action: 'submitted', createdAt: submittedAt }, { transaction });
  if (decision) {
    const marks = Math.round(task.maxMarks * marksRatio * 2) / 2;
    const assessedAt = new Date(submittedAt.getTime() + 20 * 3600 * 1000);
    await TaskAssessment.create(
      { submissionId: submission.id, reviewerId: reviewer.id, marksAwarded: marks, feedback: decision === 'request_revision' ? 'Good start, but the analysis is incomplete. Please add the missing summary statistics and explain your cleaning steps, then resubmit.' : DEMO_FEEDBACK[task.scheduledDay % DEMO_FEEDBACK.length], decision, isFinal: decision !== 'request_revision', assessedAt },
      { transaction }
    );
    await TaskReviewHistory.create(
      { submissionId: submission.id, reviewerId: reviewer.id, previousStatus: 'submitted', newStatus: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revision_required', action: `assessed_${decision}`, createdAt: assessedAt },
      { transaction }
    );
    if (decision === 'request_revision') await submission.update({ status: 'revision_required' }, { transaction });
  }
  return submission;
}

async function enrollDirect({ user, program, transaction, status }) {
  const existing = await InternshipEnrollment.findOne({ where: { userId: user.id, programId: program.id }, transaction });
  if (existing) return { enrollment: existing, created: false };
  const application = await InternshipApplication.create(
    {
      userId: user.id,
      programId: program.id,
      fullName: user.name,
      email: user.email,
      education: 'Sample education entry',
      skills: 'Sample skills entry',
      motivation: 'This is a sample application created by the Global360 demo seeder for demonstration purposes.',
      status: 'approved',
      reviewedAt: new Date(),
    },
    { transaction }
  );
  const enrollment = await InternshipEnrollment.create(
    { userId: user.id, programId: program.id, applicationId: application.id, startDate: program.startDate, endDate: program.endDate, status, enrolledAt: new Date(`${program.startDate}T00:00:00Z`) },
    { transaction }
  );
  return { enrollment, created: true };
}

export async function seedDemo(programs, password, log = console.log) {
  const now = new Date();
  const { user: student } = await ensureUser({ email: 'demo.student@example.com', name: 'Ayaan Demo', role: 'student', password });
  const { user: graduate } = await ensureUser({ email: 'demo.graduate@example.com', name: 'Sara Demo', role: 'student', password });
  const { user: reviewer } = await ensureUser({ email: 'demo.reviewer@example.com', name: 'Demo Reviewer', role: 'reviewer', password });
  const applicants = [];
  for (const n of ['Bilal Sample', 'Hina Sample', 'Omar Sample']) {
    applicants.push((await ensureUser({ email: `${slugify(n).replace(/-/g, '.')}@example.com`, name: n, role: 'student' })).user);
  }

  // Reviewer assignments
  for (const p of Object.values(programs)) {
    await InternshipReviewerAssignment.findOrCreate({ where: { programId: p.id, reviewerId: reviewer.id, enrollmentId: null }, defaults: { programId: p.id, reviewerId: reviewer.id } });
  }

  // Course enrollments with partial progress for the demo student
  const courses = await Course.findAll({ where: { isSample: true }, order: [['publishedAt', 'ASC']], limit: 3 });
  for (const [ci, course] of courses.entries()) {
    const [enrollment, created] = await CourseEnrollment.findOrCreate({ where: { userId: student.id, courseId: course.id }, defaults: { userId: student.id, courseId: course.id, enrolledAt: new Date(now - (20 - ci * 5) * 86400000) } });
    if (!created) continue;
    const lessons = await Lesson.findAll({ include: [{ model: CourseModule, as: 'module', where: { courseId: course.id }, attributes: [] }], order: [[{ model: CourseModule, as: 'module' }, 'position', 'ASC'], ['position', 'ASC']] });
    const doneCount = Math.floor(lessons.length * [0.65, 0.3, 0.1][ci]);
    for (const [li, l] of lessons.slice(0, doneCount).entries()) {
      const at = new Date(enrollment.enrolledAt.getTime() + (li + 1) * 7 * 3600 * 1000);
      await LessonProgress.create({ userId: student.id, lessonId: l.id, courseId: course.id, isCompleted: true, completedAt: at, lastViewedAt: at, updatedAt: at });
    }
  }

  // In-progress internship with realistic history
  const running = programs['data-running'];
  await sequelize.transaction(async (transaction) => {
    const { enrollment, created } = await enrollDirect({ user: student, program: running, transaction, status: 'in_progress' });
    if (!created) return;
    const tasks = await InternshipTask.findAll({ where: { programId: running.id, status: 'published', dueAt: { [Op.lt]: now } }, order: [['dueAt', 'ASC']], transaction });
    for (const [i, task] of tasks.entries()) {
      const fromEnd = tasks.length - i;
      const submittedAt = new Date(task.availableAt.getTime() + 6 * 3600 * 1000);
      if (i === 9) continue; // one missed (overdue) task
      if (fromEnd <= 2) {
        await addAssessedSubmission({ task, enrollment, reviewer, decision: null, submittedAt, transaction }); // awaiting review
      } else if (fromEnd === 4) {
        await addAssessedSubmission({ task, enrollment, reviewer, marksRatio: 0.5, decision: 'request_revision', submittedAt, transaction });
      } else {
        await addAssessedSubmission({ task, enrollment, reviewer, marksRatio: [0.9, 0.8, 0.85, 0.75, 0.95][i % 5], decision: 'approve', submittedAt, transaction });
      }
    }
  });

  // Completed internship with a qualifying score → certificate
  const completed = programs['web-completed'];
  let graduateEnrollmentId;
  await sequelize.transaction(async (transaction) => {
    const { enrollment, created } = await enrollDirect({ user: graduate, program: completed, transaction, status: 'in_progress' });
    graduateEnrollmentId = enrollment.id;
    if (!created) return;
    const tasks = await InternshipTask.findAll({ where: { programId: completed.id, status: 'published' }, order: [['dueAt', 'ASC']], transaction });
    for (const [i, task] of tasks.entries()) {
      await addAssessedSubmission({ task, enrollment, reviewer, marksRatio: [0.9, 0.8, 0.85, 0.95, 0.8][i % 5], decision: 'approve', submittedAt: new Date(task.availableAt.getTime() + 5 * 3600 * 1000), transaction });
    }
  });
  if (graduateEnrollmentId) {
    const { results, certificate } = await evaluateEnrollment(graduateEnrollmentId);
    log(`Demo graduate evaluated: ${results.outcome}, score ${results.finalScore}%${certificate ? `, certificate ${certificate.certificateNumber}` : ''}.`);
  }

  // Pending applications for the upcoming program
  const upcoming = programs['web-upcoming'];
  for (const [i, a] of applicants.entries()) {
    await InternshipApplication.findOrCreate({
      where: { userId: a.id, programId: upcoming.id },
      defaults: {
        userId: a.id,
        programId: upcoming.id,
        fullName: a.name,
        email: a.email,
        education: ['BS Computer Science (in progress)', 'Self-taught developer', 'Diploma in IT'][i],
        skills: ['HTML, CSS, basic JavaScript', 'JavaScript, React basics', 'HTML, CSS'][i],
        motivation: 'Sample application created by the demo seeder. I want practical experience building real projects with feedback from mentors.',
        status: ['pending', 'pending', 'under_review'][i],
      },
    });
  }
  log('Demo accounts: demo.student@example.com, demo.graduate@example.com, demo.reviewer@example.com (password from DEMO_USER_PASSWORD).');
}

