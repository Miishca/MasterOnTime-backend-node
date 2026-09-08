import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../lib/jwt';
import { HttpError } from './errorHandler';

export interface AuthedRequest extends Request {
  userId?: number;
  userRole?: Role;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    throw new HttpError(401, 'Missing authorization token');
  }
  try {
    const payload = verifyToken(token);
    req.userId = Number(payload.sub);
    req.userRole = payload.role;
    req.userEmail = payload.email;
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

// Java-еквівалент: @PreAuthorize("hasAnyRole(...)"). Використовувати ПІСЛЯ requireAuth.
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      throw new HttpError(403, 'Insufficient permissions');
    }
    next();
  };
}
