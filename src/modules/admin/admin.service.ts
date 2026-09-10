import { Prisma, Role, SpecialistProfile, User } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { ListUsersQuery, SetRoleInput } from './admin.schemas';

// Легкий рядок для адмін-таблиці — без base64-фото / адреси / ДН.
export interface AdminUserRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  city: string | null;
  phoneNumber: string | null;
  role: Role;
  isDeleted: boolean;
  createdAt: Date;
  hasSpecialistProfile: boolean;
  specialistProfile: {
    profession: string;
    price: string;
    about: string;
    experience: number;
    tags: string[];
  } | null;
}

const PROFILE_SELECT = {
  select: { id: true, profession: true, price: true, about: true, experience: true, tags: true },
} as const;

type ProfileSlice = Pick<
  SpecialistProfile,
  'profession' | 'price' | 'about' | 'experience' | 'tags'
>;

function toAdminRow(u: User & { specialistProfile: ProfileSlice | null }): AdminUserRow {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    city: u.addressCity,
    phoneNumber: u.phoneNumber,
    role: u.role,
    isDeleted: u.isDeleted,
    createdAt: u.createdAt,
    hasSpecialistProfile: u.specialistProfile !== null,
    specialistProfile: u.specialistProfile
      ? {
          profession: u.specialistProfile.profession,
          price: u.specialistProfile.price.toString(),
          about: u.specialistProfile.about,
          experience: u.specialistProfile.experience,
          tags: u.specialistProfile.tags,
        }
      : null,
  };
}

export async function listUsers(q: ListUsersQuery): Promise<AdminUserRow[]> {
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}),
    ...(q.search
      ? {
          OR: [
            { email: { contains: q.search, mode: 'insensitive' } },
            { firstName: { contains: q.search, mode: 'insensitive' } },
            { lastName: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { id: 'asc' },
    include: { specialistProfile: PROFILE_SELECT },
    take: 100,
  });

  return users.map(toAdminRow);
}

// PATCH /api/admin/users/:id/role — підвищити/понизити роль.
// Роль SPECIALIST супроводжується upsert-ом SpecialistProfile.
export async function setUserRole(
  targetUserId: number,
  input: SetRoleInput,
): Promise<AdminUserRow> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new HttpError(404, `User not found with id: ${targetUserId}`);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { role: input.role } });

    if (input.role === 'SPECIALIST') {
      const p = input.profile ?? {};
      await tx.specialistProfile.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          profession: p.profession ?? '',
          about: p.about ?? '',
          price: p.price ?? 0,
          experience: p.experience ?? 0,
          tags: p.tags ?? [],
        },
        update: {
          ...(p.profession !== undefined ? { profession: p.profession } : {}),
          ...(p.about !== undefined ? { about: p.about } : {}),
          ...(p.price !== undefined ? { price: p.price } : {}),
          ...(p.experience !== undefined ? { experience: p.experience } : {}),
          ...(p.tags !== undefined ? { tags: p.tags } : {}),
        },
      });
    }
    // Пониження ролі не видаляє SpecialistProfile — він просто перестає бути видимим
    // у пошуку (фільтр role=SPECIALIST). Дані бронювань/відгуків лишаються цілими.
  });

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
    include: { specialistProfile: PROFILE_SELECT },
  });
  return toAdminRow(updated);
}
