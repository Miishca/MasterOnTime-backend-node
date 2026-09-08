import bcrypt from 'bcrypt';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { signToken } from '../../lib/jwt';
import { toUserResponseDto, UserResponseDto } from '../users/user.mapper';
import { LoginInput, RegistrationInput } from './auth.schemas';

const SALT_ROUNDS = 10;

export async function registerUser(input: RegistrationInput): Promise<UserResponseDto> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(409, `User already exists with email: ${input.email}`);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phoneNumber,
      profileImage: input.profileImageUrl,
      role: input.role,
      addressCountry: input.address.country,
      addressCity: input.address.city,
      addressStreet: input.address.street,
      addressZip: input.address.zip,
      // Спеціалісту одразу заводимо профіль (D2) — інакше search/booking його не побачать.
      specialistProfile:
        input.role === 'SPECIALIST' ? { create: {} } : undefined,
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
