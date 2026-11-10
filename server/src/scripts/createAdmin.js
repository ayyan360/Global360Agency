import { sequelize, User } from '../models/index.js';
import { hashPassword } from '../services/authService.js';
import { password as passwordSchema, email as emailSchema } from '../validators/common.js';
import { audit } from '../services/auditService.js';

/**
 * Secure admin bootstrap. Reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from the environment
 * (server/.env or the shell). There is no default admin and no hard-coded password.
 * If the email already exists, the account is promoted to admin only with --promote.
 */
const promote = process.argv.includes('--promote');

try {
  const name = (process.env.ADMIN_NAME || '').trim();
  const emailResult = emailSchema.safeParse(process.env.ADMIN_EMAIL || '');
  const pwResult = passwordSchema.safeParse(process.env.ADMIN_PASSWORD || '');
  if (!name || !emailResult.success || !pwResult.success) {
    throw new Error(
      'Set ADMIN_NAME, ADMIN_EMAIL and a strong ADMIN_PASSWORD (8+ chars, letters and numbers) in server/.env or the environment, then run again.'
    );
  }
  if (/^(password|admin|global360)/i.test(pwResult.data)) throw new Error('Choose a less guessable admin password.');

  const existing = await User.findOne({ where: { email: emailResult.data } });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin ${existing.email} already exists. Nothing to do.`);
    } else if (!promote) {
      throw new Error(`A ${existing.role} account with this email exists. Re-run with --promote to make it an admin.`);
    } else {
      await existing.update({ role: 'admin', accountStatus: 'active' });
      await audit({ action: 'user.role_changed', entityType: 'User', entityId: existing.id, metadata: { via: 'create-admin script', to: 'admin' } });
      console.log(`Promoted ${existing.email} to admin.`);
    }
  } else {
    const user = await User.create({ name, email: emailResult.data, role: 'admin', passwordHash: await hashPassword(pwResult.data), passwordChangedAt: new Date() });
    await audit({ action: 'user.created', entityType: 'User', entityId: user.id, metadata: { via: 'create-admin script', role: 'admin' } });
    console.log(`Admin account created for ${user.email}. Remove ADMIN_PASSWORD from your environment now.`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
