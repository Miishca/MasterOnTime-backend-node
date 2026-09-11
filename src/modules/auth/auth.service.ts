import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { signToken } from '../../lib/jwt';
import {
  issueRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../../lib/refreshTokens';
import { toUserResponseDto, UserResponseDto } from '../users/user.mapper';
import { passwordResetEmail, sendEmail } from '../../lib/email';
import { LoginInput, RegistrationInput } from './auth.schemas';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 година

export async function registerUser(input: RegistrationInput): Promise<UserResponseDto> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, `User already exists with email: ${input.email}`);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Публічна реєстрація завжди створює USER. Роль SPECIALIST видає лише
  // адмін через PATCH /api/admin/users/:id/role.
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      profileImage: input.profileImageBase64
        ? `data:image/png;base64,${input.profileImageBase64}`
        : undefined,
      role: 'USER',
      addressCountry: input.address.country,
      addressCity: input.address.city,
      addressStreet: input.address.street,
      addressZip: input.address.zip,
    },
  });

  return toUserResponseDto(user);
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export async function loginUser(input: LoginInput): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.isDeleted) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken({ id: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  return { token, refreshToken };
}

// POST /auth/refresh — обмінює дійсний refresh-токен на нову пару (ротація).
export async function refreshAccessToken(rawRefreshToken: string): Promise<AuthTokens> {
  const rotated = await rotateRefreshToken(rawRefreshToken);
  if (!rotated) throw new HttpError(401, 'Invalid or expired refresh token');

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
  if (!user || user.isDeleted) throw new HttpError(401, 'Invalid or expired refresh token');

  const token = signToken({ id: user.id, role: user.role, email: user.email });
  return { token, refreshToken: rotated.newRawToken };
}

// POST /auth/logout — відкликає лише цю сесію (цей refresh-токен).
// Завжди "успіх": вихід з уже недійсною/чужою сесією не повинен бути помилкою.
export async function logoutUser(rawRefreshToken: string): Promise<void> {
  await revokeRefreshToken(rawRefreshToken);
}

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

// POST /auth/forgot-password — завжди відповідає успіхом, навіть якщо email не
// існує (без цього можна перебором дізнатись, які email зареєстровані).
// Реальний лист (Resend) — але sandbox-домен onboarding@resend.dev може
// слати лише на email власника акаунта Resend, тому для будь-якої іншої
// адреси send мовчки не вдасться (див. lib/email.ts). Токен зберігається
// лише як SHA-256 хеш. Повертає сирий токен ЛИШЕ як зручність для дев-режиму
// (route вирішує, чи показувати його в відповіді — див. auth.routes.ts) —
// це підстраховка, поки не всі email реально доходять.
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isDeleted) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetLink = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${rawToken}`;
  const { subject, html } = passwordResetEmail(resetLink);
  await sendEmail(email, subject, html);

  return rawToken;
}

// POST /auth/reset-password
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  // Скомпрометований пароль не повинен лишати чинними сесії, видані до скидання.
  await revokeAllUserRefreshTokens(record.userId);
}
