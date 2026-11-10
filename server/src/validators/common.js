import { z } from 'zod';

export const uuid = z.uuid({ message: 'Invalid identifier' });
export const idParam = z.object({ id: uuid });

export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Optional http(s) URL: empty string becomes null. */
export const optionalUrl = z
  .union([z.string().trim().max(500), z.null()])
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isHttpUrl(v), { message: 'Enter a valid http(s) URL' });

export const trimmed = (min, max, label = 'This field') =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (max) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const optionalDateTime = z
  .union([z.iso.datetime({ offset: true }), z.iso.datetime(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : v === undefined ? undefined : null));

export const stringList = (maxItems = 20, maxLen = 300) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { message: 'Use at least one letter and one number' });

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Enter a valid email address' }));

export const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');
