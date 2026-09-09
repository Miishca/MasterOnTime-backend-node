import { z } from 'zod';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

// Java AvailabilityRequestDto: { dayOfWeek, startTime (LocalTime), endTime (LocalTime) }
export const availabilityItemSchema = z
  .object({
    dayOfWeek: z.enum(DAYS),
    startTime: timeString,
    endTime: timeString,
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });

// PUT /api/schedule/availability — тіло це СПИСОК (як у Java)
export const availabilityListSchema = z.array(availabilityItemSchema);
export type AvailabilityItem = z.infer<typeof availabilityItemSchema>;

// Java UnavailabilityRequestDto: { start, end } (LocalDateTime) — саме такі назви полів
export const unavailabilitySchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((v) => v.start < v.end, {
    message: 'start must be before end',
    path: ['end'],
  });
export type UnavailabilityInput = z.infer<typeof unavailabilitySchema>;
