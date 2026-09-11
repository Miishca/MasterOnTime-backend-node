import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { PublicSpecialistDto, toPublicSpecialistDto } from '../search/specialist.mapper';

const withProfile = { include: { specialistProfile: true } } as const;

async function requireVisibleSpecialist(specialistUserId: number) {
  const user = await prisma.user.findFirst({
    where: {
      id: specialistUserId,
      role: 'SPECIALIST',
      visible: true,
      isDeleted: false,
      specialistProfile: { isNot: null },
    },
  });
  if (!user) throw new HttpError(404, 'Specialist not found');
}

// POST /api/favorites/:specialistId — ідемпотентно (повторний виклик — не помилка).
export async function addFavorite(userId: number, specialistUserId: number): Promise<void> {
  if (userId === specialistUserId) {
    throw new HttpError(400, 'You cannot favorite yourself');
  }
  await requireVisibleSpecialist(specialistUserId);
  await prisma.favorite.upsert({
    where: { userId_specialistUserId: { userId, specialistUserId } },
    create: { userId, specialistUserId },
    update: {},
  });
}

// DELETE /api/favorites/:specialistId
export async function removeFavorite(userId: number, specialistUserId: number): Promise<void> {
  await prisma.favorite.deleteMany({ where: { userId, specialistUserId } });
}

// GET /api/favorites — повні картки, для сторінки "Обране".
export async function listFavorites(userId: number): Promise<PublicSpecialistDto[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { specialist: withProfile },
  });
  return rows
    .filter((f) => f.specialist.role === 'SPECIALIST' && f.specialist.visible && !f.specialist.isDeleted)
    .map((f) => toPublicSpecialistDto(f.specialist));
}

// GET /api/favorites/ids — лише id, щоб фронт дешево підсвічував "серце" на картках.
export async function listFavoriteIds(userId: number): Promise<number[]> {
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { specialistUserId: true } });
  return rows.map((r) => r.specialistUserId);
}
