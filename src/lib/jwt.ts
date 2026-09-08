import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // user id (as string, per JWT spec)
  role: Role;
  email: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

export function signToken(user: { id: number; role: Role; email: string }): string {
  const payload: JwtPayload = {
    sub: String(user.id),
    role: user.role,
    email: user.email,
  };
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as SignOptions['expiresIn'];
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
