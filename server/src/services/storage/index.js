import crypto from 'node:crypto';
import path from 'node:path';
import { env } from '../../config/env.js';
import { unavailable } from '../../utils/errors.js';
import { createLocalStorage } from './localStorage.js';
import { createS3Storage } from './s3Storage.js';

/**
 * Storage abstraction for private files (submission attachments, certificate PDFs).
 * Drivers: local (development), s3 (any S3-compatible private bucket), none (disabled).
 * Interface: put(key, buffer, contentType), getStream(key), getSignedUrl(key, opts) | null, remove(key), exists(key).
 */
let driver;

export function getStorage() {
  if (driver) return driver;
  if (env.STORAGE_DRIVER === 'local') driver = createLocalStorage(env.LOCAL_STORAGE_DIR);
  else if (env.STORAGE_DRIVER === 's3') driver = createS3Storage(env);
  else driver = null;
  return driver;
}

export function isStorageConfigured() {
  try {
    return Boolean(getStorage());
  } catch {
    return false;
  }
}

export function requireStorage() {
  const s = getStorage();
  if (!s) throw unavailable('File storage has not been configured on this server. Set STORAGE_DRIVER to enable uploads.');
  return s;
}

/** Generates an unguessable storage key. User-supplied names never become part of the path. */
export function generateStorageKey(prefix, extension) {
  const safePrefix = prefix.replace(/[^a-z0-9/-]/gi, '');
  const ext = extension ? `.${String(extension).replace(/[^a-z0-9]/gi, '').slice(0, 8)}` : '';
  const d = new Date();
  return path.posix.join(
    safePrefix,
    `${d.getUTCFullYear()}`,
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    `${crypto.randomUUID()}${ext}`
  );
}

/** For tests: reset the cached driver after changing env. */
export function _resetStorage() {
  driver = undefined;
}
