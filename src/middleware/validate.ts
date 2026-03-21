import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware factory that validates req.body (and optionally
 * req.query / req.params) against a Zod schema.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), loginUser);
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          message: 'Validation failed',
          errors: err.issues.map((e) => ({
            field: e.path.slice(1).join('.'), // strip the leading 'body' segment
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
