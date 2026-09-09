import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { PublicSpecialistDto, toPublicSpecialistDto } from './specialist.mapper';
import { SearchQuery } from './search.schemas';

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
