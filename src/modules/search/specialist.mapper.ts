import { SpecialistProfile, User } from '@prisma/client';

type UserWithProfile = User & { specialistProfile: SpecialistProfile | null };

// Публічна проєкція спеціаліста — БЕЗ email / телефону / вулиці / індексу /
// дати народження / статі. Тільки те, що можна показувати гостю.
export interface PublicSpecialistDto {
  id: number; // User id (як і в UserResponseDto для спеціалістів)
  firstName: string;
  lastName: string;
  city: string | null;
  profession: string;
  about: string;
  rating: number;
  experience: number;
  tags: string[];
  price: string;
  profileImageUrl: string | null;
}

export function toPublicSpecialistDto(user: UserWithProfile): PublicSpecialistDto {
  const p = user.specialistProfile;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    city: user.addressCity,
    profession: p?.profession ?? '',
    about: p?.about ?? '',
    rating: p?.rating ?? 0,
    experience: p?.experience ?? 0,
    tags: p?.tags ?? [],
    price: p ? p.price.toString() : '0',
    profileImageUrl: user.profileImage,
  };
}

// Публічний відгук на сторінці спеціаліста — без id клієнта / бронювання.
export interface PublicReviewDto {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
  authorName: string;
}
