import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { toUserResponseDto, UserResponseDto } from '../users/user.mapper';
import { SearchQuery } from './search.schemas';

export async function searchSpecialists(q: SearchQuery): Promise<UserResponseDto[]> {
  const noFilters =
    !q.serviceName &&
    !q.firstName &&
    !q.city &&
    (!q.categories || q.categories.length === 0) &&
    q.minExperience === undefined &&
    q.minRating === undefined;

  // Java кидає 400 "At least one search parameter must be provided".
  if (noFilters) {
    throw new HttpError(400, 'At least one search parameter must be provided');
  }

  const profileFilter: Prisma.SpecialistProfileWhereInput = {};
  if (q.minExperience !== undefined) profileFilter.experience = { gte: q.minExperience };
  if (q.minRating !== undefined) profileFilter.rating = { gte: q.minRating };

  const where: Prisma.UserWhereInput = {
    role: 'SPECIALIST',
    visible: true,
    isDeleted: false,
    ...(q.firstName ? { firstName: { contains: q.firstName, mode: 'insensitive' } } : {}),
    ...(q.city ? { addressCity: { contains: q.city, mode: 'insensitive' } } : {}),
    ...(Object.keys(profileFilter).length
      ? { specialistProfile: { is: profileFilter } }
      : {}),
  };

  // TODO(Фаза 6): serviceName + categories — фільтрація по Category/CategoryItem,
  // яких ще немає в схемі. Наразі ігноруються.

  const specialists = await prisma.user.findMany({ where, orderBy: { id: 'asc' } });
  return specialists.map(toUserResponseDto);
}
