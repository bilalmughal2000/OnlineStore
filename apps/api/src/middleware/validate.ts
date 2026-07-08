import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

// Validates and replaces req[source] with the parsed value.
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      // req.query is a getter in Express 5 but assignable in 4; guard anyway.
      (req as unknown as Record<Source, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          badRequest(
            'Validation failed',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
      }
      next(err);
    }
  };
}
