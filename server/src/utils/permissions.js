/**
 * Explicit role → permission model. Backend middleware and services check permissions;
 * the frontend only uses the same list to decide what navigation to show.
 */
export const PERMISSIONS = {
  student: ['learning:use', 'internship:participate'],
  instructor: ['learning:use', 'courses:manage-own'],
  reviewer: ['learning:use', 'submissions:review-assigned'],
  admin: [
    'learning:use',
    'courses:manage',
    'courses:manage-own',
    'users:manage',
    'roles:manage',
    'internships:manage',
    'applications:manage',
    'submissions:review-all',
    'submissions:review-assigned',
    'assessments:amend',
    'certificates:manage',
    'messages:manage',
    'settings:manage',
    'reports:view',
  ],
};

export function permissionsFor(role) {
  return PERMISSIONS[role] || [];
}

export function can(user, permission) {
  return Boolean(user) && permissionsFor(user.role).includes(permission);
}
