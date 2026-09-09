import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { notifications } from '../../lib/notifications';
import { bookingInclude, BookingResponseDto, toBookingResponseDto } from './booking.mapper';
import {
  AvailableSlotsQuery,
  BlockSlotInput,
  CreateBookingInput,
  RescheduleInput,
} from './booking.schemas';

const STATUS = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  BLOCKED: 'BLOCKED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
} as const;

const DEFAULT_DURATION_MIN = 60;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;
const SLOT_STEP_MIN = 15;

async function specialistProfileByUserId(userId: number) {
  const profile = await prisma.specialistProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new HttpError(404, 'Specialist profile not found for this user');
  }
  return profile;
}

async function myProfileId(userId: number): Promise<number> {
  return (await specialistProfileByUserId(userId)).id;
}

async function serviceDuration(serviceItemId?: number): Promise<number> {
  if (!serviceItemId) return DEFAULT_DURATION_MIN;
  const item = await prisma.categoryItem.findUnique({ where: { id: serviceItemId } });
  if (!item) throw new HttpError(404, 'Service not found');
  return item.durationMinutes;
}

// Активний конфлікт: CONFIRMED або BLOCKED бронювання, що перетинається за часом.
async function hasConflict(
  specialistProfileId: number,
  start: Date,
  end: Date,
  ignoreBookingId?: number,
): Promise<boolean> {
  const clash = await prisma.booking.findFirst({
    where: {
      specialistId: specialistProfileId,
      status: { in: [STATUS.CONFIRMED, STATUS.BLOCKED] },
      startTime: { lt: end },
      endTime: { gt: start },
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
    },
  });
  return clash !== null;
}

function loadBooking(id: number) {
  return prisma.booking.findUnique({ where: { id }, include: bookingInclude });
}

export async function getAvailableTimeSlots(q: AvailableSlotsQuery): Promise<Date[]> {
  const profile = await specialistProfileByUserId(q.specialistId);
  const duration = await serviceDuration(q.serviceItemId);

  const dayStart = new Date(`${q.date}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${q.date}T${String(DAY_END_HOUR).padStart(2, '0')}:00:00`);
  const now = new Date();

  const slots: Date[] = [];
  for (
    let slotStart = new Date(dayStart);
    new Date(slotStart.getTime() + duration * 60000) <= dayEnd;
    slotStart = new Date(slotStart.getTime() + SLOT_STEP_MIN * 60000)
  ) {
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);
    if (slotStart <= now) continue;
    if (await hasConflict(profile.id, slotStart, slotEnd)) continue;
    slots.push(new Date(slotStart));
  }
  return slots;
}

export async function bookTimeSlot(
  clientId: number,
  input: CreateBookingInput,
): Promise<BookingResponseDto> {
  const specialistUser = await prisma.user.findUnique({
    where: { id: input.specialistId },
    include: { specialistProfile: true },
  });
  if (!specialistUser?.specialistProfile) {
    throw new HttpError(404, 'Specialist not found');
  }
  const profile = specialistUser.specialistProfile;

  const duration = await serviceDuration(input.serviceItemId);
  const start = input.startTime;
  const end = new Date(start.getTime() + duration * 60000);

  if (start < new Date()) {
    throw new HttpError(400, 'Cannot book a time in the past');
  }
  if (await hasConflict(profile.id, start, end)) {
    throw new HttpError(400, 'Selected time slot is not available');
  }

  const created = await prisma.booking.create({
    data: {
      clientId,
      specialistId: profile.id,
      serviceItemId: input.serviceItemId ?? null,
      startTime: start,
      endTime: end,
      status: STATUS.CONFIRMED,
      priceAtBooking: profile.price,
    },
    include: bookingInclude,
  });

  notifications.bookingCreated(created, specialistUser.id);
  return toBookingResponseDto(created);
}

export async function cancelBooking(userId: number, bookingId: number): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { specialist: { select: { userId: true } } },
  });
  if (!booking) throw new HttpError(404, 'Booking not found');

  const isParty =
    booking.clientId === userId || booking.specialist.userId === userId;
  if (!isParty) throw new HttpError(403, 'You can only cancel your own bookings');
  if (booking.status === STATUS.CANCELLED) {
    throw new HttpError(400, 'Booking already cancelled');
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: STATUS.CANCELLED },
    include: bookingInclude,
  });
  notifications.bookingCancelled(updated);
}

export async function proposeReschedule(
  specialistUserId: number,
  dto: RescheduleInput,
): Promise<void> {
  const profileId = await myProfileId(specialistUserId);
  const booking = await loadBooking(dto.bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.specialistId !== profileId) {
    throw new HttpError(403, 'Only the assigned specialist can propose a reschedule');
  }
  if (booking.status !== STATUS.CONFIRMED) {
    throw new HttpError(400, 'Only confirmed bookings can be rescheduled');
  }
  if (dto.proposedStartTime < new Date()) {
    throw new HttpError(400, 'Cannot reschedule to a past time');
  }
  if (await hasConflict(profileId, dto.proposedStartTime, dto.proposedEndTime, booking.id)) {
    throw new HttpError(400, 'New time slot conflicts with existing bookings');
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: STATUS.RESCHEDULE_REQUESTED,
      proposedStartTime: dto.proposedStartTime,
      proposedEndTime: dto.proposedEndTime,
      rescheduleMessage: dto.message ?? null,
    },
    include: bookingInclude,
  });
  notifications.rescheduleProposed(updated, booking.clientId!);
}

export async function respondToReschedule(
  clientId: number,
  bookingId: number,
  accept: boolean,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.clientId !== clientId) {
    throw new HttpError(403, 'Only the client can respond to a reschedule request');
  }
  if (booking.status !== STATUS.RESCHEDULE_REQUESTED) {
    throw new HttpError(400, 'No reschedule request pending');
  }

  const data: Prisma.BookingUpdateInput = {
    proposedStartTime: null,
    proposedEndTime: null,
    rescheduleMessage: null,
  };
  if (accept) {
    data.startTime = booking.proposedStartTime!;
    data.endTime = booking.proposedEndTime!;
    data.status = STATUS.CONFIRMED;
  } else {
    data.status = STATUS.CONFIRMED;
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data,
    include: bookingInclude,
  });
  const specialistUserId = (
    await prisma.specialistProfile.findUnique({ where: { id: booking.specialistId } })
  )!.userId;
  if (accept) notifications.rescheduleAccepted(updated, specialistUserId);
  else notifications.rescheduleDeclined(updated, specialistUserId);
}

export async function blockTimeSlot(
  specialistUserId: number,
  input: BlockSlotInput,
): Promise<BookingResponseDto> {
  const profile = await specialistProfileByUserId(specialistUserId);
  if (input.startTime < new Date()) {
    throw new HttpError(400, 'Cannot block past time slots');
  }
  if (input.endTime <= input.startTime) {
    throw new HttpError(400, 'End time must be after start time');
  }
  if (await hasConflict(profile.id, input.startTime, input.endTime)) {
    throw new HttpError(400, 'Time slot conflicts with existing bookings');
  }

  const created = await prisma.booking.create({
    data: {
      specialistId: profile.id,
      clientId: null,
      startTime: input.startTime,
      endTime: input.endTime,
      status: STATUS.BLOCKED,
      reason: input.reason ?? null,
      priceAtBooking: profile.price,
    },
    include: bookingInclude,
  });
  return toBookingResponseDto(created);
}

export async function unblockTimeSlot(
  bookingId: number,
  specialistUserId: number,
): Promise<void> {
  const profileId = await myProfileId(specialistUserId);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.specialistId !== profileId) {
    throw new HttpError(403, 'You can only unblock your own blocked slots');
  }
  if (booking.status !== STATUS.BLOCKED) {
    throw new HttpError(400, 'Booking is not a blocked slot');
  }
  await prisma.booking.delete({ where: { id: bookingId } });
}

export async function getUpcomingAppointments(userId: number): Promise<BookingResponseDto[]> {
  const rows = await prisma.booking.findMany({
    where: {
      status: STATUS.CONFIRMED,
      startTime: { gte: new Date() },
      OR: [{ clientId: userId }, { specialist: { userId } }],
    },
    orderBy: { startTime: 'asc' },
    include: bookingInclude,
  });
  return rows.map(toBookingResponseDto);
}

// Java: findByClientIdAndStatus(userId, CONFIRMED) — тільки як клієнт.
export async function getConfirmedBookingsForUser(userId: number): Promise<BookingResponseDto[]> {
  const rows = await prisma.booking.findMany({
    where: { clientId: userId, status: STATUS.CONFIRMED },
    orderBy: { startTime: 'asc' },
    include: bookingInclude,
  });
  return rows.map(toBookingResponseDto);
}

export async function getBookingsForSpecialistOnDate(
  specialistProfileId: number,
  date: string,
): Promise<BookingResponseDto[]> {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);
  const rows = await prisma.booking.findMany({
    where: {
      specialistId: specialistProfileId,
      status: STATUS.CONFIRMED,
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: 'asc' },
    include: bookingInclude,
  });
  return rows.map(toBookingResponseDto);
}

export async function getBookingById(
  bookingId: number,
  userId: number,
): Promise<BookingResponseDto> {
  const booking = await loadBooking(bookingId);
  if (!booking) throw new HttpError(404, 'Booking not found');
  const specialistUserId = (
    await prisma.specialistProfile.findUnique({ where: { id: booking.specialistId } })
  )!.userId;
  if (booking.clientId !== userId && specialistUserId !== userId) {
    throw new HttpError(403, 'You do not have access to this booking');
  }
  return toBookingResponseDto(booking);
}
