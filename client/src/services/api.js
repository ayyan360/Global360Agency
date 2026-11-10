import axios from 'axios';

/**
 * Central Axios client. Auth uses an HTTP-only session cookie (never stored in JS).
 * State-changing requests carry the CSRF token returned by /auth/csrf in X-CSRF-Token.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

let csrfToken = null;
let csrfPromise = null;

export function setCsrfToken(token) {
  if (token) csrfToken = token;
}

export async function ensureCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = api
      .get('/auth/csrf')
      .then((res) => {
        csrfToken = res.data.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

const UNSAFE = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use(async (config) => {
  if (UNSAFE.has((config.method || 'get').toLowerCase())) {
    const token = await ensureCsrf();
    config.headers = config.headers || {};
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.data?.data?.csrfToken) setCsrfToken(res.data.data.csrfToken);
    return res;
  },
  async (error) => {
    const { config, response } = error;
    // Retry once with a fresh CSRF token if it was missing/rotated.
    if (response?.status === 403 && response.data?.error?.code === 'CSRF_INVALID' && config && !config._csrfRetried) {
      config._csrfRetried = true;
      await ensureCsrf(true);
      return api(config);
    }
    return Promise.reject(normalizeError(error));
  }
);

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  fieldErrors() {
    return Object.fromEntries((this.details || []).filter((d) => d.field).map((d) => [d.field, d.message]));
  }
}

function normalizeError(error) {
  if (error instanceof ApiError) return error;
  if (error.response) {
    const e = error.response.data?.error || {};
    return new ApiError({
      status: error.response.status,
      code: e.code || 'ERROR',
      message: e.message || 'Something went wrong. Please try again.',
      details: e.details,
    });
  }
  if (error.code === 'ECONNABORTED') return new ApiError({ status: 0, code: 'TIMEOUT', message: 'The request timed out. Please try again.' });
  return new ApiError({ status: 0, code: 'NETWORK', message: 'Unable to reach the server. Check your connection and try again.' });
}

/** Unwraps { data, meta } responses. */
export const unwrap = (res) => res.data;

export async function downloadFile(url, fallbackName) {
  const res = await api.get(url, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const apiUrl = (path) => `${api.defaults.baseURL.replace(/\/$/, '')}${path}`;
