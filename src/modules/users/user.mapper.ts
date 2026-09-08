import { User } from '@prisma/client';

// Відповідає Java UserResponseDto (com.master.on.time...dto.UserResponseDto).
export interface AddressDto {
  country: string | null;
  city: string | null;
  street: string | null;
  zip: string | null;
}

export interface UserResponseDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  address: AddressDto | null;
  phoneNumber: string | null;
  profileImageUrl: string | null;
  dateOfBirth: string | null; // ISO-дата "YYYY-MM-DD"
  gender: User['gender'];
}

export function toUserResponseDto(user: User): UserResponseDto {
  const hasAddress =
    user.addressCountry !== null ||
    user.addressCity !== null ||
    user.addressStreet !== null ||
    user.addressZip !== null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    address: hasAddress
      ? {
          country: user.addressCountry,
          city: user.addressCity,
          street: user.addressStreet,
          zip: user.addressZip,
        }
      : null,
    phoneNumber: user.phoneNumber,
    profileImageUrl: user.profileImage,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    gender: user.gender,
  };
}
