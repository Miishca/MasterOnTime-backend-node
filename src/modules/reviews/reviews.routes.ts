import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

export const reviewsRouter = Router();

reviewsRouter.use(requireAuth);

// POST /api/reviews/booking/:bookingId
reviewsRouter.post('/booking/:bookingId', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// GET /api/reviews/specialist
reviewsRouter.get('/specialist', (_req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});
