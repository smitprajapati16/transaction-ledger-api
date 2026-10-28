const AppError = require('../utils/app-error');

/**
 * Higher-order middleware to validate incoming request data using Zod.
 *
 * @param {object} schemas
 * @param {import('zod').ZodSchema} [schemas.body]
 * @param {import('zod').ZodSchema} [schemas.params]
 * @param {import('zod').ZodSchema} [schemas.query]
 */
function validateRequest({ body, params, query }) {
  return (req, res, next) => {
    try {
      if (params) {
        const parsedParams = params.safeParse(req.params);
        if (!parsedParams.success) {
          const message = parsedParams.error.issues.map((i) => i.message).join(', ');
          return next(new AppError(message, 400, parsedParams.error.issues));
        }
        req.params = parsedParams.data;
      }

      if (query) {
        const parsedQuery = query.safeParse(req.query);
        if (!parsedQuery.success) {
          const message = parsedQuery.error.issues.map((i) => i.message).join(', ');
          return next(new AppError(message, 400, parsedQuery.error.issues));
        }
        req.query = parsedQuery.data;
      }

      if (body) {
        const parsedBody = body.safeParse(req.body);
        if (!parsedBody.success) {
          const message = parsedBody.error.issues.map((i) => i.message).join(', ');
          return next(new AppError(message, 400, parsedBody.error.issues));
        }
        req.body = parsedBody.data;
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = validateRequest;

