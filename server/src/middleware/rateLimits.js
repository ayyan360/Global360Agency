import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } }),
  });

export const apiLimiter = make(60 * 1000, 300, 'Too many requests. Please slow down.');
export const authLimiter = make(15 * 60 * 1000, 20, 'Too many authentication attempts. Please wait 15 minutes and try again.');
export const contactLimiter = make(60 * 60 * 1000, 5, 'Too many messages sent. Please try again later.');
export const applicationLimiter = make(60 * 60 * 1000, 10, 'Too many applications submitted. Please try again later.');
export const uploadLimiter = make(60 * 60 * 1000, 60, 'Too many uploads. Please try again later.');
export const assistantLimiter = make(60 * 1000, 15, 'Too many assistant requests. Please wait a moment and try again.');
