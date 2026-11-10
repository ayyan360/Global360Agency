import { Op } from 'sequelize';
import {
  sequelize,
  InternshipProgram,
  InternshipApplication,
  InternshipEnrollment,
  User,
} from '../../models/index.js';
import { notFound, badRequest, conflict, forbidden } from '../../utils/errors.js';
import { toLimitOffset, pageMeta, likeTerm } from '../../utils/pagination.js';
import { notify } from '../notificationService.js';
import { audit } from '../auditService.js';
import { applicationWindow } from './programService.js';
import { hasProgramStarted } from './scheduleService.js';

export const APPLICATION_TRANSITIONS = {
  pending: ['under_review', 'approved', 'rejected', 'waitlisted'],
  under_review: ['approved', 'rejected', 'waitlisted'],
  waitlisted: ['under_review', 'approved', 'rejected'],
  approved: [],
  rejected: [],
  withdrawn: [],
};
const ACTIVE_APPLICATION = ['pending', 'under_review', 'approved', 'waitlisted'];
const ACTIVE_ENROLLMENT = ['approved', 'in_progress', 'completed_qualified', 'completed_not_qualified'];

/**
 * Applications are always tied to the authenticated account. The contact email is the
 * account's email (never taken from the form), so applicants cannot apply on someone else's behalf.
 */
export async function submitApplication(user, programId, data) {
  if (user.role !== 'student') throw forbidden('Only student accounts can apply for internships.');
  const program = await InternshipProgram.findByPk(programId);
  if (!program || program.status !== 'published') throw notFound('Internship program not found.');
  const window = applicationWindow(program);
  if (!window.isOpen) {
    throw badRequest(window.state === 'not_yet_open' ? 'Applications for this program are not open yet.' : 'Applications for this program are closed.', { code: 'APPLICATIONS_CLOSED' });
  }
  const enrollment = await InternshipEnrollment.findOne({ where: { userId: user.id, programId } });
  if (enrollment) throw conflict('You are already enrolled in this internship.', { code: 'ALREADY_ENROLLED' });
  const active = await InternshipApplication.findOne({ where: { userId: user.id, programId, status: ACTIVE_APPLICATION } });
  if (active) throw conflict('You already have an active application for this program.', { code: 'DUPLICATE_APPLICATION' });

  try {
    return await sequelize.transaction(async (transaction) => {
      const application = await InternshipApplication.create(
        {
          userId: user.id,
          programId,
          fullName: data.fullName,
          email: user.email,
          phone: data.phone || null,
          education: data.education || null,
          experience: data.experience || null,
          skills: data.skills || null,
          motivation: data.motivation,
          portfolioUrl: data.portfolioUrl || null,
          status: 'pending',
        },
        { transaction }
      );
      await notify(
        {
          userId: user.id,
          type: 'application_received',
          title: 'Application received',
          message: `We received your application for ${program.title}. We'll notify you when it has been reviewed.`,
          resourceType: 'InternshipApplication',
          resourceId: application.id,
          link: '/student/internship',
          dedupeKey: `application-received:${application.id}`,
        },
        { transaction }
      );
      const admins = await User.findAll({ where: { role: 'admin', accountStatus: 'active' }, attributes: ['id'], transaction });
      for (const a of admins) {
        await notify(
          {
            userId: a.id,
            type: 'application_submitted',
            title: 'New internship application',
            message: `${data.fullName} applied for ${program.title}.`,
            resourceType: 'InternshipApplication',
            resourceId: application.id,
            link: `/admin/internship-applications/${application.id}`,
            dedupeKey: `application-submitted:${application.id}`,
          },
          { transaction }
        );
      }
      return application;
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') throw conflict('You already have an active application for this program.', { code: 'DUPLICATE_APPLICATION' });
    throw err;
  }
}

export async function listMyApplications(user) {
  const rows = await InternshipApplication.findAll({
    where: { userId: user.id },
    include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'slug', 'track', 'startDate', 'endDate'] }],
    order: [['createdAt', 'DESC']],
  });
  return rows.map((a) => ({ ...a.toApplicantJSON(), program: a.program }));
}

export async function withdrawApplication(user, applicationId) {
  const app = await InternshipApplication.findOne({ where: { id: applicationId, userId: user.id } });
  if (!app) throw notFound('Application not found.');
  if (!['pending', 'under_review', 'waitlisted'].includes(app.status)) throw badRequest('This application can no longer be withdrawn.');
  await app.update({ status: 'withdrawn' });
  return app.toApplicantJSON();
}

// ---------------- Admin ----------------

export async function adminListApplications({ programId, status, search, page = 1, pageSize = 20 }) {
  const where = {};
  if (programId) where.programId = programId;
  if (status) where.status = status;
  if (search) where[Op.or] = [{ fullName: { [Op.iLike]: likeTerm(search) } }, { email: { [Op.iLike]: likeTerm(search) } }];
  const { rows, count } = await InternshipApplication.findAndCountAll({
    where,
    include: [{ model: InternshipProgram, as: 'program', attributes: ['id', 'title', 'track'] }],
    order: [['createdAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows, meta: pageMeta({ page, pageSize }, count) };
}

export async function adminGetApplication(id) {
  const app = await InternshipApplication.findByPk(id, {
    include: [
      { model: InternshipProgram, as: 'program' },
      { model: User, as: 'applicant', attributes: ['id', 'name', 'email', 'createdAt'] },
      { model: User, as: 'reviewer', attributes: ['id', 'name'] },
    ],
  });
  if (!app) throw notFound('Application not found.');
  const enrollment = await InternshipEnrollment.findOne({ where: { applicationId: id } });
  return { ...app.get({ plain: true }), enrollment };
}

/**
 * Validated status transition. Approval creates the internship enrollment in the same
 * transaction, locking the program row so capacity can't be exceeded by concurrent approvals.
 */
export async function decideApplication(admin, id, { status, publicFeedback, internalNotes }, { ip } = {}) {
  const result = await sequelize.transaction(async (transaction) => {
    const app = await InternshipApplication.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!app) throw notFound('Application not found.');
    const allowed = APPLICATION_TRANSITIONS[app.status] || [];
    if (!allowed.includes(status)) {
      throw badRequest(`An application cannot move from "${app.status.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}".`, { code: 'INVALID_TRANSITION' });
    }
    const program = await InternshipProgram.findByPk(app.programId, { transaction, lock: transaction.LOCK.UPDATE });
    let enrollment = null;

    if (status === 'approved') {
      if (program.status === 'archived') throw badRequest('This program is archived.');
      const existing = await InternshipEnrollment.findOne({ where: { userId: app.userId, programId: app.programId }, transaction });
      if (existing) throw conflict('This applicant is already enrolled in the program.', { code: 'ALREADY_ENROLLED' });
      if (program.capacity) {
        const taken = await InternshipEnrollment.count({ where: { programId: program.id, status: ACTIVE_ENROLLMENT }, transaction });
        if (taken >= program.capacity) throw conflict('The program is at capacity. Waitlist the applicant instead.', { code: 'AT_CAPACITY' });
      }
      enrollment = await InternshipEnrollment.create(
        {
          userId: app.userId,
          programId: app.programId,
          applicationId: app.id,
          startDate: program.startDate,
          endDate: program.endDate,
          status: hasProgramStarted(program) ? 'in_progress' : 'approved',
          enrolledAt: new Date(),
        },
        { transaction }
      );
    }

    const previous = app.status;
    await app.update(
      {
        status,
        publicFeedback: publicFeedback ?? app.publicFeedback,
        internalNotes: internalNotes ?? app.internalNotes,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
      { transaction }
    );

    await audit({
      actorId: admin.id,
      action: `application.${status}`,
      entityType: 'InternshipApplication',
      entityId: app.id,
      metadata: { from: previous, to: status, programId: app.programId, enrollmentId: enrollment?.id },
      ip,
      transaction,
    });

    const messages = {
      approved: ['application_approved', 'Application approved', `Congratulations! You've been accepted into ${program.title}.`],
      rejected: ['application_rejected', 'Application update', `Your application for ${program.title} was not successful this time.`],
      waitlisted: ['application_waitlisted', 'Application waitlisted', `Your application for ${program.title} has been placed on the waitlist.`],
      under_review: ['application_under_review', 'Application under review', `Your application for ${program.title} is being reviewed.`],
    };
    const [type, title, message] = messages[status];
    await notify(
      { userId: app.userId, type, title, message, resourceType: 'InternshipApplication', resourceId: app.id, link: '/student/internship', dedupeKey: `application-${status}:${app.id}` },
      { transaction }
    );
    if (enrollment) {
      await notify(
        {
          userId: app.userId,
          type: 'enrollment_activated',
          title: 'Internship enrollment activated',
          message: `Your internship dashboard for ${program.title} is now available. The program starts on ${program.startDate}.`,
          resourceType: 'InternshipEnrollment',
          resourceId: enrollment.id,
          link: '/student/internship',
          dedupeKey: `enrollment-activated:${enrollment.id}`,
        },
        { transaction }
      );
    }
    return { application: app, enrollment };
  });
  return result;
}
