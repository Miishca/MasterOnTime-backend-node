import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed', issues: err.issues });
  }
  // express.json() over the size limit, or malformed JSON body
  if (err && typeof err === 'object' && 'type' in err) {
    const type = (err as { type?: string }).type;
    if (type === 'entity.too.large') {
      return res.status(413).json({ message: 'The uploaded image is too large.' });
    }
    if (type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Malformed JSON body.' });
    }
  }
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}
