import { unprocessable } from '../utils/errors.js';

/**
 * Validates request parts with Zod schemas. Parsed (and stripped) values are placed on req.valid,
 * so controllers never read unvalidated input. Unknown keys are dropped (mass-assignment protection).
 */
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const [part, schema] of Object.entries({ params, query, body })) {
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        return next(unprocessable('Please correct the highlighted fields.', details));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
