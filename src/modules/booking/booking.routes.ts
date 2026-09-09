import { NextFunction, Response, Router } from 'express';
import { AuthedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { HttpError } from '../../middleware/errorHandler';
import {
  availableSlotsQuerySchema,
  blockSlotSchema,
  createBookingSchema,
  rescheduleResponseSchema,
  rescheduleSchema,
} from './booking.schemas';
import * as service from './booking.service';

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// GET /api/bookings/available-slots?specialistId&serviceItemId&date
bookingRouter.get(
  '/available-slots',
  requireRole('USER'),
  wrap(async (req, res) => {
    const q = availableSlotsQuerySchema.parse(req.query);
    res.json(await service.getAvailableTimeSlots(q));
  }),
);

// POST /api/bookings
bookingRouter.post(
  '/',
  requireRole('USER'),
  wrap(async (req, res) => {
    const input = createBookingSchema.parse(req.body);
    res.status(201).json(await service.bookTimeSlot(req.userId!, input));
  }),
);

// POST /api/bookings/reschedule
bookingRouter.post(
  '/reschedule',
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    const dto = rescheduleSchema.parse(req.body);
    await service.proposeReschedule(req.userId!, dto);
    res.sendStatus(204);
  }),
);

// POST /api/bookings/:bookingId/reschedule-response
bookingRouter.post(
  '/:bookingId/reschedule-response',
  requireRole('USER'),
  wrap(async (req, res) => {
    const { accept } = rescheduleResponseSchema.parse(req.body);
    await service.respondToReschedule(req.userId!, bookingIdParam(req), accept);
    res.sendStatus(204);
  }),
);

// POST /api/bookings/:bookingId/cancel
bookingRouter.post(
  '/:bookingId/cancel',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    await service.cancelBooking(req.userId!, bookingIdParam(req));
    res.sendStatus(204);
  }),
);

// POST /api/bookings/block
bookingRouter.post(
  '/block',
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    const input = blockSlotSchema.parse(req.body);
    res.status(201).json(await service.blockTimeSlot(req.userId!, input));
  }),
);

// DELETE /api/bookings/block/:bookingId
bookingRouter.delete(
  '/block/:bookingId',
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    await service.unblockTimeSlot(bookingIdParam(req), req.userId!);
    res.sendStatus(204);
  }),
);

// GET /api/bookings/appointments/upcoming
bookingRouter.get(
  '/appointments/upcoming',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await service.getUpcomingAppointments(req.userId!));
  }),
);

// GET /api/bookings/confirmed
bookingRouter.get(
  '/confirmed',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await service.getConfirmedBookingsForUser(req.userId!));
  }),
);

// POST /api/bookings/sync-google-calendar — Фаза 6
bookingRouter.post('/sync-google-calendar', (_req, res) => {
  res.status(501).json({ message: 'Google Calendar sync not implemented yet' });
});

// GET /api/bookings/provider/:specialistId/date/:date  (specialistId = SpecialistProfile id)
bookingRouter.get(
  '/provider/:specialistId/date/:date',
  requireRole('SPECIALIST'),
  wrap(async (req, res) => {
    const specialistProfileId = Number(req.params.specialistId);
    if (!Number.isInteger(specialistProfileId) || specialistProfileId <= 0) {
      throw new HttpError(400, 'Invalid specialist id');
    }
    res.json(await service.getBookingsForSpecialistOnDate(specialistProfileId, req.params.date));
  }),
);

// GET /api/bookings/:bookingId
bookingRouter.get(
  '/:bookingId',
  requireRole('USER', 'SPECIALIST'),
  wrap(async (req, res) => {
    res.json(await service.getBookingById(bookingIdParam(req), req.userId!));
  }),
);

function bookingIdParam(req: AuthedRequest): number {
  const id = Number(req.params.bookingId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid booking id');
  }
  return id;
}
