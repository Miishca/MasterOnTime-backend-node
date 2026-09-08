import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { toUserResponseDto, UserResponseDto } from './user.mapper';
import { UpdateProfileInput } from './users.schemas';

export async function getUserById(id: number): Promise<UserResponseDto> {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) {
    throw new HttpError(404, `User not found with id: ${id}`);
  }
  return toUserResponseDto(user);
}

export async function updateUserProfile(
  userId: number,
  dto: UpdateProfileInput,
): Promise<UserResponseDto> {
  const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!user) {
    throw new HttpError(404, `User not found with id: ${userId}`);
  }

  if (dto.email && dto.email !== user.email) {
    const clash = await prisma.user.findUnique({ where: { email: dto.email } });
    if (clash) {
      throw new HttpError(409, `Email already in use: ${dto.email}`);
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (dto.firstName !== undefined) data.firstName = dto.firstName;
  if (dto.lastName !== undefined) data.lastName = dto.lastName;
  if (dto.email !== undefined) data.email = dto.email;
  if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
  if (dto.dateOfBirth !== undefined) {
    data.dateOfBirth = dto.dateOfBirth ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`) : null;
  }
  if (dto.gender !== undefined) data.gender = dto.gender;
  if (dto.address) {
    if (dto.address.country !== undefined) data.addressCountry = dto.address.country;
    if (dto.address.city !== undefined) data.addressCity = dto.address.city;
    if (dto.address.street !== undefined) data.addressStreet = dto.address.street;
    if (dto.address.zip !== undefined) data.addressZip = dto.address.zip;
  }
  if (dto.profileImageBase64) {
    // Java зберігає так само — inline data URI (storeProfileImage).
    data.profileImage = `data:image/png;base64,${dto.profileImageBase64}`;
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return toUserResponseDto(updated);
}

export async function getAllSpecialists(): Promise<UserResponseDto[]> {
  const specialists = await prisma.user.findMany({
    where: { role: 'SPECIALIST', visible: true, isDeleted: false },
    orderBy: { id: 'asc' },
  });
  return specialists.map(toUserResponseDto);
}
