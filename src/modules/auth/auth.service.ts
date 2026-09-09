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
