import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '../..');

const nodeEnv = process.env.NODE_ENV || 'development';

// Load server/.env (or server/.env.test when testing). Real environment variables always win.
dotenv.config({
  path: path.join(SERVER_ROOT, nodeEnv === 'test' ? '.env.test' : '.env'),
  quiet: true,
});

const bool = (def) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === true || v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: bool(false),
  DB_LOGGING: bool(false),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(24),
  COOKIE_SECURE: bool(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z.string().trim().min(1).default('openai/gpt-oss-120b'),
  STORAGE_DRIVER: z.enum(['local', 's3', 'none']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('storage/private'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool(false),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ENABLE_JOBS: bool(true),
  SERVE_CLIENT: bool(false),
  CERTIFICATE_ISSUER_NAME: z.string().default('Global360 Internship Program'),
  CERTIFICATE_SIGNATORY_NAME: z.string().optional(),
  CERTIFICATE_SIGNATORY_TITLE: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['none', 'smtp']).default('none'),
  RATE_LIMIT_DISABLED: bool(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\nInvalid server configuration. Copy server/.env.example to server/.env and fill it in.\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  appUrl: parsed.data.PUBLIC_APP_URL || parsed.data.CLIENT_URL.split(',')[0].trim(),
  clientOrigins: parsed.data.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean),
};

if (env.isProd && !env.COOKIE_SECURE) {
  console.warn('[config] COOKIE_SECURE is false in production. Set COOKIE_SECURE=true when serving over HTTPS.');
}
