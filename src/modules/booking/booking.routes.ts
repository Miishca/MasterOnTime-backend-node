import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

// GET /api/bookings/available-slots
bookingRouter.get('/available-slots', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// POST /api/bookings
bookingRouter.post('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// POST /api/bookings/:bookingId/cancel
bookingRouter.post('/:bookingId/cancel', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
