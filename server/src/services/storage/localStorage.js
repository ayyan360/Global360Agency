import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { SERVER_ROOT } from '../../config/env.js';

/**
 * Local private storage for development. Files live outside any static/public directory and are only
 * served through authorized API endpoints. Keys are validated to prevent path traversal.
 */
export function createLocalStorage(dir) {
  const root = path.resolve(SERVER_ROOT, dir);
  fs.mkdirSync(root, { recursive: true });

  const resolveKey = (key) => {
    if (typeof key !== 'string' || key.includes('\0') || path.isAbsolute(key)) throw new Error('Invalid storage key');
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  };

  return {
    name: 'local',
    root,
    async put(key, buffer) {
      const full = resolveKey(key);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, buffer, { flag: 'wx', mode: 0o600 });
    },
    async getStream(key) {
      const full = resolveKey(key);
      await fsp.access(full);
      return fs.createReadStream(full);
    },
    async getBuffer(key) {
      return fsp.readFile(resolveKey(key));
    },
    async getSignedUrl() {
      return null; // local driver streams through the API instead
    },
    async exists(key) {
      try {
        await fsp.access(resolveKey(key));
        return true;
      } catch {
        return false;
      }
    },
    async remove(key) {
      await fsp.rm(resolveKey(key), { force: true });
    },
  };
}
