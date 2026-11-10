import { AuditLog } from '../models/index.js';

/**
 * Records a privileged action. Metadata should describe *what changed*, never secrets
 * or sensitive submission content.
 */
export async function audit({ actorId = null, action, entityType, entityId = null, metadata = {}, ip = null, transaction } = {}) {
  return AuditLog.create({ actorId, action, entityType, entityId, metadata, ip }, { transaction });
}
