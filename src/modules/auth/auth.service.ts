import bcrypt from 'bcrypt';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { RegistrationInput } from './auth.schemas';

const SALT_ROUNDS = 10;

export async function registerUser(input: RegistrationInput) {
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
      profileImageUrl: input.profileImageUrl,
      addressCountry: input.address.country,
      addressCity: input.address.city,
      addressStreet: input.address.street,
      addressZip: input.address.zip,
    },
  });

  const { passwordHash: _omit, ...safeUser } = user;
  return safeUser;
}
