import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://global360:placeholder@db.example.test:5432/global360',
  DATABASE_SSL: 'true',
  DATABASE_SSL_CA: '',
  JWT_SECRET: 'test-only-secret-'.repeat(6),
  COOKIE_SECURE: 'true',
  CLIENT_URL: 'https://app.example.test',
  PUBLIC_APP_URL: 'https://app.example.test',
  RATE_LIMIT_DISABLED: 'false',
};

function inspectProductionConfig(overrides = {}, script = "import('./src/config/env.js').then(() => console.log('accepted'))") {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: serverDirectory,
    env: { ...process.env, ...productionEnvironment, ...overrides },
    encoding: 'utf8',
  });
}

describe('Production configuration', () => {
  it('rejects insecure or incomplete production settings', () => {
    const result = inspectProductionConfig({
      COOKIE_SECURE: 'false',
      DATABASE_SSL: 'false',
      STORAGE_DRIVER: 'none',
      CLIENT_URL: 'http://app.example.test',
      RATE_LIMIT_DISABLED: 'true',
      JWT_SECRET: 'replace-this-secret'.repeat(5),
    });

    assert.notEqual(result.status, 0);
    for (const setting of ['COOKIE_SECURE', 'DATABASE_SSL', 'STORAGE_DRIVER', 'CLIENT_URL', 'RATE_LIMIT_DISABLED', 'JWT_SECRET']) {
      assert.match(result.stderr, new RegExp(setting));
    }
  });

  it('requires S3 credentials only when the S3 driver is selected', () => {
    const result = inspectProductionConfig({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: '',
      S3_REGION: '',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    });

    assert.notEqual(result.status, 0);
    for (const setting of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      assert.match(result.stderr, new RegExp(setting));
    }
  });

  it('accepts the default local storage in production without S3 and validates database TLS certificates', () => {
    const result = inspectProductionConfig({}, "import('./src/config/database.js').then(({ sequelize }) => console.log(JSON.stringify({ accepted: true, rejectUnauthorized: sequelize.options.dialectOptions.ssl.rejectUnauthorized })))");

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), { accepted: true, rejectUnauthorized: true });
  });
});
