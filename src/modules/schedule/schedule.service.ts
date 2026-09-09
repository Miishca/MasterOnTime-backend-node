import { DayOfWeek } from '@prisma/client';
import { prisma } from '../../config/db';
import { AvailabilityItem, UnavailabilityInput } from './schedule.schemas';

export interface AvailabilityDto {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}
export interface UnavailabilityDto {
  start: Date;
  end: Date;
}

// PUT /api/schedule/availability — видалити все й записати заново (як Java setAvailability)
export async function setAvailability(
  specialistUserId: number,
  items: AvailabilityItem[],
): Promise<void> {
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { specialistId: specialistUserId } }),
    prisma.availability.createMany({
      data: items.map((i) => ({
        specialistId: specialistUserId,
        dayOfWeek: i.dayOfWeek,
        startTime: i.startTime,
        endTime: i.endTime,
      })),
    }),
  ]);
}

export async function getAvailability(specialistUserId: number): Promise<AvailabilityDto[]> {
  const rows = await prisma.availability.findMany({
    where: { specialistId: specialistUserId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }));
}

// POST /api/schedule/unavailability — додати (як Java addUnavailability)
export async function addUnavailability(
  specialistUserId: number,
  input: UnavailabilityInput,
): Promise<void> {
  await prisma.unavailability.create({
    data: { specialistId: specialistUserId, startTime: input.start, endTime: input.end },
  });
}

export async function getUnavailabilities(specialistUserId: number): Promise<UnavailabilityDto[]> {
  const rows = await prisma.unavailability.findMany({
    where: { specialistId: specialistUserId },
    orderBy: { startTime: 'asc' },
  });
  return rows.map((r) => ({ start: r.startTime, end: r.endTime }));
}
