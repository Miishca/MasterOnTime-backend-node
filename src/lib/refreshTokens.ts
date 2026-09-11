// Refresh-токени — той самий підхід, що й PasswordResetToken: у БД лежить
// лише SHA-256 хеш, сирий токен ніколи не зберігається. Ротація на кожен
// /auth/refresh (старий одразу revoked) — типовий захист від повторного
// використання вкраденого refresh-токена (reuse detection у простому вигляді:
// якщо хтось спробує повторно вжити вже revoked токен, rotate поверне null).
import crypto from 'crypto';
import { prisma } from '../config/db';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 днів

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

export async function issueRefreshToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

// Валідний, невідкликаний, не прострочений refresh-токен -> revoke його й
// видати новий (ротація) для того самого юзера. null, якщо токен не годиться.
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ userId: number; newRawToken: string } | null> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  const newRawToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, newRawToken };
}

// POST /auth/logout — відкликає конкретний refresh-токен (одну сесію).
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Зміна пароля (reset) -> відкликаємо ВСІ сесії юзера: скомпрометований
// пароль не повинен лишати робочі refresh-токени, видані до скидання.
export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
