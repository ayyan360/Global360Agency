import { Notification } from '../models/index.js';
import { toLimitOffset, pageMeta } from '../utils/pagination.js';
import { notFound } from '../utils/errors.js';

/**
 * Creates an in-app notification. When dedupeKey is provided the insert is idempotent
 * (unique per user + key), which makes scheduled jobs safe to re-run.
 */
export async function notify({ userId, type, title, message, resourceType, resourceId, link, dedupeKey }, { transaction } = {}) {
  if (dedupeKey) {
    const [row, created] = await Notification.findOrCreate({
      where: { userId, dedupeKey },
      defaults: { userId, type, title, message, resourceType, resourceId, link, dedupeKey },
      transaction,
    });
    row.wasCreated = created;
    return row;
  }
  return Notification.create({ userId, type, title, message, resourceType, resourceId, link }, { transaction });
}

export async function notifyMany(userIds, payload, opts) {
  for (const userId of userIds) {
    await notify({ ...payload, userId, dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}` : undefined }, opts);
  }
}

export async function listNotifications(userId, { page, pageSize, unreadOnly }) {
  const where = { userId };
  if (unreadOnly) where.isRead = false;
  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    ...toLimitOffset({ page, pageSize }),
  });
  return { items: rows, meta: pageMeta({ page, pageSize }, count) };
}

export const unreadCount = (userId) => Notification.count({ where: { userId, isRead: false } });

export async function markRead(userId, id) {
  const n = await Notification.findOne({ where: { id, userId } });
  if (!n) throw notFound('Notification not found.');
  if (!n.isRead) await n.update({ isRead: true, readAt: new Date() });
  return n;
}

export async function markAllRead(userId) {
  const [count] = await Notification.update({ isRead: true, readAt: new Date() }, { where: { userId, isRead: false } });
  return count;
}
