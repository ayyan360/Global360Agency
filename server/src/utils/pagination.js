import { z } from 'zod';

export const MAX_PAGE_SIZE = 50;

export const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12),
};

export function toLimitOffset({ page = 1, pageSize = 12 }) {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  return { limit: size, offset: (page - 1) * size };
}

export function pageMeta({ page, pageSize }, total) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Escape LIKE wildcards in user search input. */
export function likeTerm(term) {
  return `%${String(term).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
