import { SiteSetting } from '../models/index.js';

/**
 * Admin-configured public site settings. Nothing here is shown as real company
 * information until an administrator has entered it.
 */
export const SETTING_DEFAULTS = {
  contact: { email: '', phone: '', address: '', hours: '' },
  social: { facebook: '', linkedin: '', x: '', youtube: '', instagram: '', github: '' },
  site: { tagline: 'Learn practical skills, gain real experience and grow your career.', supportEmail: '' },
};

export const CERTIFICATE_PAYMENT_DEFAULTS = { bankName: '', accountHolder: '', accountNumber: '' };

export async function getSetting(key) {
  const row = await SiteSetting.findByPk(key);
  const defaults = key === 'certificatePayments' ? CERTIFICATE_PAYMENT_DEFAULTS : SETTING_DEFAULTS[key] || {};
  return { ...defaults, ...(row?.value || {}) };
}

export async function getPublicSettings() {
  const rows = await SiteSetting.findAll({ where: { key: Object.keys(SETTING_DEFAULTS) } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = {};
  for (const key of Object.keys(SETTING_DEFAULTS)) out[key] = { ...SETTING_DEFAULTS[key], ...(map[key] || {}) };
  return out;
}

export async function updateSetting(key, value, userId) {
  const merged = { ...(await getSetting(key)), ...value };
  await SiteSetting.upsert({ key, value: merged, updatedBy: userId, updatedAt: new Date() });
  return merged;
}
