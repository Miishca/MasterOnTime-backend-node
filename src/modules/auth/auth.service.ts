import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { signToken } from '../../lib/jwt';
import { toUserResponseDto, UserResponseDto } from '../users/user.mapper';
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

export async function loginUser(input: LoginInput): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.isDeleted) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return { token: signToken({ id: user.id, role: user.role, email: user.email }) };
}

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

// POST /auth/forgot-password — завжди відповідає успіхом, навіть якщо email не
// існує (без цього можна перебором дізнатись, які email зареєстровані).
// Немає SMTP/email-сервісу — "лист" іде в лог сервера, той самий підхід, що й
// lib/notifications.ts для бронювань. Токен зберігається лише як SHA-256 хеш.
// Повертає сирий токен ЛИШЕ як зручність для дев-режиму (route вирішує, чи
// показувати його в відповіді — див. auth.routes.ts); зовнішній виклик не
// повинен покладатись на це значення в проді.
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

  // eslint-disable-next-line no-console
  console.log(
    `[password-reset stub] no email service configured — would send to ${email}: ` +
      `reset token = ${rawToken} (expires in 1h)`,
  );
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
}
