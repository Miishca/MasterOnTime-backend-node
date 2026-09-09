import { z } from 'zod';

// GET /api/bookings/available-slots
export const availableSlotsQuerySchema = z.object({
  specialistId: z.coerce.number().int().positive(), // це User id спеціаліста
  serviceItemId: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;

// POST /api/bookings
export const createBookingSchema = z.object({
  specialistId: z.coerce.number().int().positive(), // User id спеціаліста (як у Java)
  serviceItemId: z.coerce.number().int().positive().optional(),
  startTime: z.coerce.date(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// POST /api/bookings/reschedule
export const rescheduleSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  proposedStartTime: z.coerce.date(),
  proposedEndTime: z.coerce.date(),
  message: z.string().max(500).optional(),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

// POST /api/bookings/:bookingId/reschedule-response
export const rescheduleResponseSchema = z.object({ accept: z.boolean() });

// POST /api/bookings/block
export const blockSlotSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  reason: z.string().max(500).optional(),
});
export type BlockSlotInput = z.infer<typeof blockSlotSchema>;
