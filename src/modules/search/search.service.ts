import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import {
  PublicReviewDto,
  PublicSpecialistDto,
  toPublicSpecialistDto,
} from './specialist.mapper';
import { SearchQuery, SpecialistProfileUpdate } from './search.schemas';

const BASE_WHERE: Prisma.UserWhereInput = {
  role: 'SPECIALIST',
  visible: true,
  isDeleted: false,
  specialistProfile: { isNot: null },
};

const withProfile = { include: { specialistProfile: true } } as const;

// GET /api/specialists — усі видимі спеціалісти (публічно)
export async function listSpecialists(): Promise<PublicSpecialistDto[]> {
  const rows = await prisma.user.findMany({
    where: BASE_WHERE,
    orderBy: { id: 'asc' },
    ...withProfile,
  });
  return rows.map(toPublicSpecialistDto);
}

// GET /api/specialists/:id — один спеціаліст (публічно)
export async function getSpecialistById(id: number): Promise<PublicSpecialistDto> {
  const user = await prisma.user.findFirst({
    where: { id, ...BASE_WHERE },
    ...withProfile,
  });
  if (!user) throw new HttpError(404, 'Specialist not found');
  return toPublicSpecialistDto(user);
}

// GET /api/specialists/:id/reviews — видимі відгуки спеціаліста (публічно)
export async function getSpecialistReviews(userId: number): Promise<PublicReviewDto[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...BASE_WHERE },
    include: { specialistProfile: { select: { id: true } } },
  });
  if (!user?.specialistProfile) throw new HttpError(404, 'Specialist not found');

  const reviews = await prisma.review.findMany({
    where: { specialistId: user.specialistProfile.id, status: 'VISIBLE' },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { firstName: true, lastName: true } } },
  });

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    authorName: `${r.author.firstName} ${r.author.lastName}`.trim(),
  }));
}

// Спільно для GET/PUT /api/specialists/me та PATCH /api/admin/users/:id/specialist-profile.
async function requireSpecialist(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, ...withProfile });
  if (!user || user.role !== 'SPECIALIST' || !user.specialistProfile) {
    throw new HttpError(404, 'Specialist profile not found');
  }
  return user;
}

// GET /api/specialists/me
export async function getMySpecialistProfile(userId: number): Promise<PublicSpecialistDto> {
  return toPublicSpecialistDto(await requireSpecialist(userId));
}

// PUT /api/specialists/me  та  PATCH /api/admin/users/:id/specialist-profile
export async function updateSpecialistProfile(
  userId: number,
  input: SpecialistProfileUpdate,
): Promise<PublicSpecialistDto> {
  await requireSpecialist(userId);
  await prisma.specialistProfile.update({
    where: { userId },
    data: {
      ...(input.profession !== undefined ? { profession: input.profession } : {}),
      ...(input.about !== undefined ? { about: input.about } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.experience !== undefined ? { experience: input.experience } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    },
  });
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId }, ...withProfile });
  return toPublicSpecialistDto(updated);
}

// GET /api/specialists/search — фільтрований пошук (публічно)
export async function searchSpecialists(q: SearchQuery): Promise<PublicSpecialistDto[]> {
  const noFilters =
    !q.serviceName &&
    !q.firstName &&
    !q.city &&
    (!q.categories || q.categories.length === 0) &&
    q.minExperience === undefined &&
    q.minRating === undefined;

  // Без жодного фільтра пошук = повний список (Java кидав 400; для публічного
  // перегляду зручніше повернути всіх).
  if (noFilters) return listSpecialists();

  const profileFilter: Prisma.SpecialistProfileWhereInput = {};
  if (q.minExperience !== undefined) profileFilter.experience = { gte: q.minExperience };
  if (q.minRating !== undefined) profileFilter.rating = { gte: q.minRating };

  const where: Prisma.UserWhereInput = {
    ...BASE_WHERE,
    ...(q.firstName ? { firstName: { contains: q.firstName, mode: 'insensitive' } } : {}),
    ...(q.city ? { addressCity: { contains: q.city, mode: 'insensitive' } } : {}),
    ...(Object.keys(profileFilter).length
      ? { specialistProfile: { is: profileFilter } }
      : {}),
  };

  // TODO(Фаза 6): serviceName + categories — фільтрація по Category/CategoryItem.
  const rows = await prisma.user.findMany({ where, orderBy: { id: 'asc' }, ...withProfile });
  return rows.map(toPublicSpecialistDto);
}
