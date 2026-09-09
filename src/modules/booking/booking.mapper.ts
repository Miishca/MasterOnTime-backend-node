import { Booking, CategoryItem, SpecialistProfile, User } from '@prisma/client';

type BookingWithRelations = Booking & {
  specialist: SpecialistProfile & { user: Pick<User, 'firstName' | 'lastName'> };
  serviceItem: Pick<CategoryItem, 'id' | 'name'> | null;
};

// Відповідає Java BookingResponseDto.
// Увага: specialistId тут — це id SpecialistProfile (не User), як у Java DTO.
export interface BookingResponseDto {
  id: number;
  clientId: number | null;
  serviceItemId: number | null;
  specialistId: number;
  specialistName: string;
  serviceName: string | null;
  price: string;
  startTime: Date;
  endTime: Date;
  rescheduleMessage: string | null;
  status: string;
}

export function toBookingResponseDto(b: BookingWithRelations): BookingResponseDto {
  return {
    id: b.id,
    clientId: b.clientId,
    serviceItemId: b.serviceItem?.id ?? null,
    specialistId: b.specialistId,
    specialistName: `${b.specialist.user.firstName} ${b.specialist.user.lastName}`,
    serviceName: b.serviceItem?.name ?? null,
    price: b.priceAtBooking.toString(),
    startTime: b.startTime,
    endTime: b.endTime,
    rescheduleMessage: b.rescheduleMessage,
    status: b.status,
  };
}

export const bookingInclude = {
  specialist: { include: { user: { select: { firstName: true, lastName: true } } } },
  serviceItem: { select: { id: true, name: true } },
} as const;
