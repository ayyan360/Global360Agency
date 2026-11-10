import crypto from 'node:crypto';

export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

/** Returns a slug unique for the given model, appending a short suffix on collision. */
export async function uniqueSlug(Model, base, { excludeId, transaction } = {}) {
  const root = slugify(base) || 'item';
  let candidate = root;
  for (let i = 0; i < 6; i += 1) {
    const existing = await Model.findOne({ where: { slug: candidate }, attributes: ['id'], transaction });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${crypto.randomBytes(3).toString('hex')}`;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}
